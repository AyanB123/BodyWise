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
import { Save, UserCircle } from 'lucide-react';

const profileFormSchema = z.object({
  height: z.coerce.number().positive({ message: 'Height must be positive.' }).min(50, { message: 'Height must be at least 50 cm.' }).max(300, { message: 'Height cannot exceed 300 cm.' }),
  weight: z.coerce.number().positive({ message: 'Weight must be positive.' }).min(20, { message: 'Weight must be at least 20 kg.' }).max(500, { message: 'Weight cannot exceed 500 kg.' }),
  age: z.coerce.number().int().positive({ message: 'Age must be a positive integer.' }).min(1, { message: 'Age must be at least 1.' }).max(120, { message: 'Age cannot exceed 120.' }),
  gender: z.enum(['male', 'female', 'other', ''], { required_error: "Gender is required."}).refine(val => val !== '', { message: "Please select a gender."}),
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
      height: profile.height || undefined, // Use undefined for react-hook-form to treat as empty initially for type="number"
      weight: profile.weight || undefined,
      age: profile.age || undefined,
      gender: profile.gender || '',
      ethnicity: profile.ethnicity || '',
    },
    mode: "onChange", // Validate on change for better UX
  });

  function onSubmit(values: z.infer<typeof profileFormSchema>) {
    setProfile(values as UserProfile); 
    toast({
      title: "Profile Updated",
      description: "Your information has been saved successfully.",
      variant: "default",
      className: "bg-green-600/90 border-green-700 text-white" // Custom success toast
    });
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-card to-secondary/20 p-6 md:p-8">
        <CardTitle className="text-3xl md:text-4xl font-bold flex items-center text-foreground">
          <UserCircle className="mr-3 h-8 w-8 text-primary" />
          Your Personal Profile
        </CardTitle>
        <CardDescription className="text-base md:text-lg text-foreground/70">
          Accurate information helps us provide precise body composition analysis and personalized insights.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 md:p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-md">Height (cm)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 175" {...field} className="text-base py-3 px-4"/>
                    </FormControl>
                    <FormDescription className="text-sm">Enter your height in centimeters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-md">Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 70" {...field} className="text-base py-3 px-4"/>
                    </FormControl>
                    <FormDescription className="text-sm">Enter your weight in kilograms.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-md">Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 30" {...field} className="text-base py-3 px-4"/>
                    </FormControl>
                    <FormDescription className="text-sm">Enter your age in years.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-md">Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-base py-3 px-4">
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDER_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value} className="text-base">{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-sm">Select your biological sex.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ethnicity"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-md">Ethnicity (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-base py-3 px-4">
                          <SelectValue placeholder="Select your ethnicity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ETHNICITY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value} className="text-base">{option.label}</SelectItem>
                        ))}
                         <SelectItem value="" className="text-base italic">Prefer not to say / Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-sm">This helps improve analysis accuracy. Select "Other" if not listed or you prefer not to say.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button 
              type="submit" 
              size="lg" 
              className="w-full md:w-auto text-lg py-3 px-8 bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg hover:shadow-primary/40 transition-all duration-300 transform hover:scale-105"
              disabled={!form.formState.isDirty && form.formState.isValid} // Disable if no changes or invalid
            >
              <Save className="mr-2 h-5 w-5" />
              Save Profile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
