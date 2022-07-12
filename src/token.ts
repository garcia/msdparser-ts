export const MSD_TOKENS = [
    'text',
    'start_parameter',
    'next_component',
    'end_parameter',
    'escape',
    'comment',
] as const;

export type MSDToken = typeof MSD_TOKENS[number];
