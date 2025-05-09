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
import { useEffect } from 'react';

const profileFormSchema = z.object({
  height: z.coerce.number().positive({ message: 'Height must be positive.' }).min(50, { message: 'Height must be at least 50 cm.' }).max(300, { message: 'Height cannot exceed 300 cm.' }),
  weight: z.coerce.number().positive({ message: 'Weight must be positive.' }).min(20, { message: 'Weight must be at least 20 kg.' }).max(500, { message: 'Weight cannot exceed 500 kg.' }),
  age: z.coerce.number().int().positive({ message: 'Age must be a positive integer.' }).min(1, { message: 'Age must be at least 1.' }).max(120, { message: 'Age cannot exceed 120.' }),
  gender: z.enum(GENDER_OPTIONS.map(opt => opt.value) as [string, ...string[]], { required_error: "Gender is required."}).refine(val => val !== '', { message: "Please select a gender."}),
  ethnicity: z.enum(ETHNICITY_OPTIONS.map(opt => opt.value) as [string, ...string[]]).optional().or(z.literal('')),
});

const defaultProfile: UserProfile = {
  height: '',
  weight: '',
  age: '',
  gender: '',
  ethnicity: '',
};

// Helper function to safely get values for form initialization
const getSafeFormValue = (value: number | string | undefined | null): string | number => {
  if (typeof value === 'number') {
    return value;
  }
  return (typeof value === 'string') ? value : '';
};

export default function UserProfileForm() {
  const [profile, setProfile] = useLocalStorage<UserProfile | null>('userProfile', defaultProfile);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      height: getSafeFormValue(profile ? profile.height : defaultProfile.height),
      weight: getSafeFormValue(profile ? profile.weight : defaultProfile.weight),
      age: getSafeFormValue(profile ? profile.age : defaultProfile.age),
      gender: (profile ? profile.gender : defaultProfile.gender) || '',
      ethnicity: (profile ? profile.ethnicity : defaultProfile.ethnicity) || '',
    },
    mode: "onChange",
  });

  // Effect to reset form when profile data changes (e.g., after loading from localStorage)
  useEffect(() => {
    if (profile) {
      form.reset({
        height: getSafeFormValue(profile.height),
        weight: getSafeFormValue(profile.weight),
        age: getSafeFormValue(profile.age),
        gender: profile.gender || '',
        ethnicity: profile.ethnicity || '',
      });
    } else {
      // If profile becomes null (e.g. user clears data or initial load from empty/invalid storage)
      form.reset({
        height: getSafeFormValue(defaultProfile.height),
        weight: getSafeFormValue(defaultProfile.weight),
        age: getSafeFormValue(defaultProfile.age),
        gender: defaultProfile.gender || '',
        ethnicity: defaultProfile.ethnicity || '',
      });
    }
  }, [profile, form]);

  function onSubmit(values: z.infer<typeof profileFormSchema>) {
    // Ensure that the stored profile matches the UserProfile structure, even if some fields are empty strings
    const profileToSave: UserProfile = {
        height: values.height, // Already coerced to number by Zod
        weight: values.weight, // Already coerced to number by Zod
        age: values.age,       // Already coerced to number by Zod
        gender: values.gender as UserProfile['gender'], // Cast as Zod ensures it's one of the valid enum values
        ethnicity: (values.ethnicity as UserProfile['ethnicity']) || '', // Ensure ethnicity is not undefined
    };
    setProfile(profileToSave);
    toast({
      title: "Profile Updated",
      description: "Your information has been saved successfully.",
      variant: "default",
      className: "bg-green-600/90 border-green-700 text-white"
    });
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-2xl overflow-hidden my-8 md:my-12 bg-card/80 backdrop-blur-md border-border/20">
      <CardHeader className="bg-gradient-to-br from-card to-secondary/10 p-6 md:p-8 border-b border-border/20">
        <CardTitle className="text-3xl md:text-4xl font-bold flex items-center text-primary">
          <UserCircle className="mr-3 h-10 w-10" />
          Personal Profile
        </CardTitle>
        <CardDescription className="text-base md:text-lg text-foreground/70 mt-1">
          Accurate details ensure precise body composition analysis.
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
                    <FormLabel className="text-md font-medium text-foreground/90">Height (cm)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 175" {...field} value={field.value ?? ''} className="text-base py-3 px-4 bg-input/50 border-input hover:border-primary/50 focus:border-primary focus:ring-primary/20"/>
                    </FormControl>
                    <FormDescription className="text-xs text-foreground/60">Enter your height in centimeters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-md font-medium text-foreground/90">Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 70" {...field} value={field.value ?? ''} className="text-base py-3 px-4 bg-input/50 border-input hover:border-primary/50 focus:border-primary focus:ring-primary/20"/>
                    </FormControl>
                    <FormDescription className="text-xs text-foreground/60">Enter your weight in kilograms.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-md font-medium text-foreground/90">Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 30" {...field} value={field.value ?? ''} className="text-base py-3 px-4 bg-input/50 border-input hover:border-primary/50 focus:border-primary focus:ring-primary/20"/>
                    </FormControl>
                    <FormDescription className="text-xs text-foreground/60">Enter your age in years.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-md font-medium text-foreground/90">Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="text-base py-3 px-4 bg-input/50 border-input hover:border-primary/50 focus:border-primary focus:ring-primary/20">
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDER_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value} className="text-base">{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-foreground/60">Select your biological sex.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ethnicity"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-md font-medium text-foreground/90">Ethnicity (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="text-base py-3 px-4 bg-input/50 border-input hover:border-primary/50 focus:border-primary focus:ring-primary/20">
                          <SelectValue placeholder="Select your ethnicity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ETHNICITY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value} className="text-base">{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-foreground/60">This helps improve analysis accuracy.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto text-lg py-3.5 px-10 bg-primary hover:bg-primary/85 text-primary-foreground rounded-full font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all duration-300 transform hover:scale-105"
              disabled={form.formState.isSubmitting}
            >
              <Save className="mr-2.5 h-5 w-5" />
              Save Profile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
