import chalk from 'chalk';
import expressWinston from 'express-winston';
import _ from 'lodash';
import moment from 'moment';
import shortid from 'shortid';
import winston from 'winston';
import config from './config/env';

// TODO: from config
const level = config.loggerLevel;
const json = config.loggerJson;

const colorize = !json;

const options = {
   exitOnError: false,
   transports: [
      new winston.transports.Console({
         level,
         handleException: true,
         json,
         colorize
      })
   ],
   filters: [(msgLevel, msg, meta) => {
      if ((meta) && (meta.error) && (meta.error instanceof Array) && (meta.error.length > 0)) {
         if (json) {
            if (msg.length === 0) {
               return meta.error[0];
            }
         } else {
            let msgWithError = msg;
            meta.error.forEach((errorLine) => {
               msgWithError += `\n${errorLine}`;
            });
            delete meta.error; // eslint-disable-line no-param-reassign
            return msgWithError;
         }
      }
      return msg;
   }],
   rewriters: [(msgLevel, msg, meta) => {
      if ((meta) && (meta.error) && (meta.error instanceof Error)) {
         const exceptionMeta = winston.exception.getAllInfo(meta.error);
         const clone = _.clone(meta);
         clone.error = exceptionMeta.stack;
         return clone;
      }
      return meta;
   }]
};
if (json) {
   options.transports[0].stringify = obj => JSON.stringify(obj);
}

const logger = new winston.Logger(options);
export default logger;

class Wrapper {
   req;

   constructor(req) {
      this.req = req;
   }

   log(winstonLevel, args) {
      const lastArg = args[args.length - 1];
      const ts = `+${moment.utc().diff(this.req.now)}ms`;
      if (typeof lastArg === 'object') {
         lastArg.cId = this.req.cId;
         lastArg.ts = ts;
         logger.log(winstonLevel, ...args);
      } else {
         logger.log(winstonLevel, ...args, { ts, cId: this.req.cId });
      }
   }

   error(...args) { this.log('error', args); }

   warn(...args) { this.log('warn', args); }

   info(...args) { this.log('info', args); }

   verbose(...args) { this.log('verbose', args); }

   debug(...args) { this.log('debug', args); }

   silly(...args) { this.log('silly', args); }
}

function fillRequest(req) {
   req.logger = new Wrapper(req);
   req.cId = shortid.generate();
   req.now = moment.utc(req._startTime);
   req.startUtc = req.now.format();
   req.userEmail = (req.user) ? req.user.email : 'n/a';
}

const expressOptions = {
   winstonInstance: logger,
   colorize,
};
if (json) {
   expressOptions.meta = true;
   expressOptions.msg = ' ';
   expressOptions.requestWhitelist = ['method', 'url', 'userEmail', 'startUtc', 'cId'];
   expressOptions.responseWhitelist = ['statusCode'];
} else {
   expressOptions.meta = false;
   let expressMsg = '{{req.method}} {{req.url}} {{res.statusCode}} {{req.startUtc}} {{res.responseTime}}ms {{req.userEmail}} [{{req.cId}}]';
   expressMsg = (colorize) ? chalk.gray(expressMsg) : expressMsg;
   expressOptions.msg = expressMsg;
}
export const middleware = [
   expressWinston.logger(expressOptions),
   (req, res, next) => {
      fillRequest(req);
      next();
   }
];

export const errorMiddleware = (error, req, res, next) => {
   req.logger.error({ error });
   next(error);
};
