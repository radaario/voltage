import { NotificationSpecs } from '@voltage/config/types';
export declare function createJobNotification(job: any, jobStatus: string): Promise<any>;
export declare function retryJobNotification(notification: any): Promise<any>;
export declare function notify(specs: NotificationSpecs, payload: any): Promise<any>;
//# sourceMappingURL=notifier.d.ts.map