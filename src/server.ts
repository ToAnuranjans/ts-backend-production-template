import app from './app';
import config from './config/config';
import { initRateLimiter } from './config/rateLimiter';
import databaseService from './service/databaseService';
import logger from './util/logger';

let server: ReturnType<typeof app.listen>;

// Function to handle graceful shutdown
const gracefulShutdown = (error?: Error) => {
    if (error) {
        logger.error('APPLICATION_ERROR', { meta: error });
    }

    if (server) {
        server.close((err) => {
            if (err) {
                logger.error('SERVER_CLOSE_ERROR', { meta: err });
                process.exit(1);
            }
            logger.info('SERVER_CLOSED_GRACEFULLY');
            process.exit(error ? 1 : 0);
        });
    } else {
        process.exit(error ? 1 : 0);
    }
};

// Start the server
const startServer = () => {
    try {
        // Start server listening
        server = app.listen(config.PORT, () => {
            (() => {
                logger.info('SERVER_STARTED', {
                    meta: {
                        PORT: config.PORT,
                        SERVER_URL: config.SERVER_URL,
                    },
                });

                // Proceed with database connection after server starts
                void initializeServices();
            })();
        });

    } catch (error: unknown) {
        gracefulShutdown(error);
    }
};

// Initialize database connection and rate limiter
const initializeServices = async () => {
    try {
        // Database connection
        const connection = await databaseService.connect();
        logger.info('DATABASE_CONNECTION', {
            meta: { CONNECTION_NAME: connection.name },
        });

        // Initialize rate limiter
        initRateLimiter(connection);
        logger.info('RATE_LIMITER_INITIATED');
    } catch (error) {
        gracefulShutdown(error);
    }
};

// Catch uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    logger.error('UNCAUGHT_EXCEPTION', { meta: error });
    gracefulShutdown(error);
});

process.on('unhandledRejection', (reason) => {
    logger.error('UNHANDLED_REJECTION', { meta: reason });
    gracefulShutdown(reason instanceof Error ? reason : new Error(String(reason)));
});

// Start the server
startServer();
