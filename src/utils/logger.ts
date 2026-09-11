import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

const isTTY = Boolean(process.stdout.isTTY);
const isProd = process.env.NODE_ENV === 'production';

// Structured JSON for cloud/container logs (Render, Neon, etc.) so logs can
// be parsed by log-shippers. Human-readable + colorized text only on a real
// TTY in dev.
const format = isProd
  ? winston.format.json()
  : combine(
      isTTY ? colorize({ all: true }) : winston.format.uncolorize(),
      timestamp({
        format: 'YYYY-MM-DD hh:mm:ss.SSS A',
      }),
      align(),
      printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
    );

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format,
  transports: [new winston.transports.Console()],
});

export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
