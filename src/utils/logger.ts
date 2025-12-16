import * as clack from '@clack/prompts';
import pc from 'picocolors';

export class Logger {
  static info(message: string): void {
    clack.log.info(message);
  }

  static success(message: string): void {
    clack.log.success(message);
  }

  static error(message: string): void {
    clack.log.error(message);
  }

  static warn(message: string): void {
    clack.log.warn(message);
  }

  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(pc.gray('[DEBUG]'), message);
    }
  }
}
