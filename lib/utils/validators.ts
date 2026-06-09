import { z } from 'zod';

export const LoginFormSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe requis'),
});

export type LoginFormInput = z.infer<typeof LoginFormSchema>;

export const UpdateRestaurantSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const SetAdminFeeSchema = z.object({
  restaurantId: z.string().uuid(),
  feePercent: z.number().min(0).max(30),
});
