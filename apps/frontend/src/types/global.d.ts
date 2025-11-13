declare module '*.webp' {
    const content: string;
    export default content;
}

declare module '*.png' {
    const content: string;
    export default content;
}

declare module '*.jpg' {
    const content: string;
    export default content;
}

declare module '*.jpeg' {
    const content: string;
    export default content;
}

declare module '*.svg' {
    const content: string;
    export default content;
}

// Minimal typings for timeago-react to satisfy TypeScript
declare module 'timeago-react' {
    import * as React from 'react';

    export interface TimeAgoProps {
        datetime: string | number | Date;
        locale?: string;
        live?: boolean;
        className?: string;
        opts?: {
            minInterval?: number;
        };
    }

    const TimeAgo: React.FC<TimeAgoProps>;
    export default TimeAgo;
}