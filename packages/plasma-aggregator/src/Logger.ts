import winston, { format } from 'winston'
const { combine, timestamp, label, printf, splat } = format

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`
})

const logger = winston.createLogger({
  levels: { error: 0, warning: 1, info: 2, debug: 3 },
  format: combine(
    label({ label: 'plasma-aggregator' }),
    timestamp(),
    splat(),
    myFormat
  ),
  transports: [
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'info'
    })
  ]
})

export default logger
