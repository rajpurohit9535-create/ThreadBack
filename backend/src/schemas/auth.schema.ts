import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .trim()
    .email({ message: 'Invalid email address' })
    .max(255),
  name: z
    .string({ message: 'Name is required' })
    .trim()
    .min(1, { message: 'Name cannot be empty' })
    .max(100),
  password: z
    .string({ message: 'Password is required' })
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(128),
});

export const loginSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .trim()
    .email({ message: 'Invalid email address' }),
  password: z
    .string({ message: 'Password is required' })
    .min(1, { message: 'Password cannot be empty' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
