import { z } from 'zod';

/** Account deletion (ACC-6): the user re-types their email to confirm. */
export const DeleteAccountSchema = z.object({ confirmEmail: z.string().trim().min(3).max(320) });
export type DeleteAccountRequest = z.infer<typeof DeleteAccountSchema>;

export const ExportFormatSchema = z.enum(['json', 'md']).default('json');
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
