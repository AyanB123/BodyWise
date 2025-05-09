'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserProfile } from '@/lib/types';
import { GENDER_OPTIONS, ETHNICITY_OPTIONS } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

const profileFormSchema = z.object({
  height: z.coerce.number().positive({ message: 'Height must be positive.' }).min(50, { message: 'Height must be at least 50 cm.' }).max(300, { message: 'Height cannot exceed 300 cm.' }),
  weight: z.coerce.number().positive({ message: 'Weight must be positive.' }).min(20, { message: 'Weight must be at least 20 kg.' }).max(500, { message: 'Weight cannot exceed 500 kg.' }),
  age: z.coerce.number().int().positive({ message: 'Age must be a positive integer.' }).min(1, { message: 'Age must be at least 1.' }).max(120, { message: 'Age cannot exceed 120.' }),
  gender: z.enum(['male', 'female', 'other', '']),
  ethnicity: z.enum(['asian', 'black', 'caucasian', 'hispanic', 'other', '']),
});

const defaultProfile: UserProfile = {
  height: '',
  weight: '',
  age: '',
  gender: '',
  ethnicity: '',
};

export default function UserProfileForm() {
  const [profile, setProfile] = useLocalStorage<UserProfile>('userProfile', defaultProfile);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      height: profile.height || '',
      weight: profile.weight || '',
      age: profile.age || '',
      gender: profile.gender || '',
      ethnicity: profile.ethnicity || '',
    },
  });

  function onSubmit(values: z.infer<typeof profileFormSchema>) {
    setProfile(values as UserProfile); // Cast is safe due to zod schema matching UserProfile structure
    toast({
      title: "Profile Saved",
      description: "Your profile information has been updated successfully.",
      variant: "default",
    });
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl">Your Profile</CardTitle>
        <CardDescription>
          Please provide your information. This helps in providing accurate body composition analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 175" {...field} />
                    </FormControl>
                    <FormDescription>Your height in centimeters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 70" {...field} />
                    </FormControl>
                    <FormDescription>Your weight in kilograms.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 30" {...field} />
                    </FormControl>
                    <FormDescription>Your age in years.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDER_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Your biological sex.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ethnicity"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Ethnicity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your ethnicity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ETHNICITY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Your ethnicity (optional, helps improve accuracy).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" size="lg" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              <Save className="mr-2 h-5 w-5" />
              Save Profile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
