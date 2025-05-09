'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { UserProfile, AnalysisResult } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import Link from 'next/link';
import Image from 'next/image';
import { Award, BarChart3, HeartPulse, Info, RefreshCw } from 'lucide-react';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts"

const chartConfig = {
  bodyFat: { label: "Body Fat %", color: "hsl(var(--primary))" },
  leanMass: { label: "Lean Mass (kg)", color: "hsl(var(--accent))" },
  visceralFat: { label: "Visceral Fat", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig


export default function ResultsDisplay() {
  const [profile] = useLocalStorage<UserProfile | null>('userProfile', null);
  const [results, setResults] = useLocalStorage<AnalysisResult | null>('latestAnalysisResult', null);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate fetching/calculating results
  useEffect(() => {
    setIsLoading(true);
    const calculateMockResults = () => {
      if (!profile || !profile.weight || !profile.height) {
        // If no profile, set results to null or some default empty state.
        setResults(null);
        setIsLoading(false);
        return;
      }
      // Simple BMI calculation
      const heightM = Number(profile.height) / 100;
      const weightKg = Number(profile.weight);
      const bmi = weightKg / (heightM * heightM);

      // Mock other values
      const bodyFatPercentage = Math.round((bmi * 0.8 + Math.random() * 10) * 10) / 10; // Loosely based on BMI
      const leanMuscleMass = Math.round((weightKg * (1 - bodyFatPercentage / 100)) * 10) / 10;
      const visceralFat = Math.round((Math.random() * 5 + 1) * 10) / 10; // Mock value

      const newResult: AnalysisResult = {
        id: new Date().toISOString(),
        date: new Date().toISOString(),
        bodyFatPercentage: parseFloat(bodyFatPercentage.toFixed(1)),
        visceralFat: parseFloat(visceralFat.toFixed(1)),
        leanMuscleMass: parseFloat(leanMuscleMass.toFixed(1)),
        bmi: parseFloat(bmi.toFixed(1)),
      };
      setResults(newResult);

      // Add to tracking history (simplified)
      const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]') as AnalysisResult[];
      const updatedHistory = [newResult, ...history.slice(0, 9)]; // Keep last 10
      localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
      
      setIsLoading(false);
    };

    // Simulate delay for calculation
    const timer = setTimeout(calculateMockResults, 1500);
    return () => clearTimeout(timer);
  }, [profile, setResults]);


  const MetricCard = ({ title, value, unit, icon: Icon, colorClass = "text-primary" }: { title: string, value: string | number, unit?: string, icon: React.ElementType, colorClass?: string }) => (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}{unit && <span className="text-xl text-muted-foreground ml-1">{unit}</span>}</div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <RefreshCw className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Calculating your results...</p>
      </div>
    );
  }

  if (!profile || !profile.weight || !profile.height) {
    return (
      <Card className="w-full max-w-lg mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive">Profile Incomplete</CardTitle>
        </CardHeader>
        <CardContent>
          <Image src="https://picsum.photos/seed/profile-missing/300/200" alt="Profile illustration" width={300} height={200} className="mx-auto rounded-md mb-4" data-ai-hint="profile data" />
          <p className="text-muted-foreground mb-4">
            Please complete your profile to view your body composition analysis.
          </p>
          <Link href="/profile">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Go to Profile</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  
  if (!results) {
     return (
      <Card className="w-full max-w-lg mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">No Results Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <Image src="https://picsum.photos/seed/no-results/300/200" alt="Analysis illustration" width={300} height={200} className="mx-auto rounded-md mb-4" data-ai-hint="data analysis" />
          <p className="text-muted-foreground mb-4">
            It seems we couldn't calculate your results. This might be due to incomplete photo capture or a temporary issue.
          </p>
          <Link href="/capture">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Start Photo Capture</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { metric: "Body Fat", value: results.bodyFatPercentage, fill: "var(--color-bodyFat)"},
    { metric: "Lean Mass", value: results.leanMuscleMass, fill: "var(--color-leanMass)" },
    { metric: "Visceral Fat", value: results.visceralFat, fill: "var(--color-visceralFat)" }, // Note: Visceral fat unit might differ
  ];


  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center"><Award className="mr-3 h-8 w-8 text-accent" />Your Body Composition Results</CardTitle>
          <CardDescription>
            Based on your profile and captured photos. Dated: {new Date(results.date).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard title="Body Fat" value={results.bodyFatPercentage} unit="%" icon={BarChart3} colorClass="text-primary" />
            <MetricCard title="Lean Muscle Mass" value={results.leanMuscleMass} unit="kg" icon={BarChart3} colorClass="text-accent" />
            <MetricCard title="Visceral Fat Level" value={results.visceralFat} unit="" icon={HeartPulse} colorClass="text-red-500" />
            <MetricCard title="BMI" value={results.bmi} unit="" icon={BarChart3} colorClass="text-yellow-500" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Metrics Overview</CardTitle>
              <CardDescription>Visual representation of key metrics.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="metric" type="category" tickLine={false} axisLine={false} width={100} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                    <Bar dataKey="value" radius={5}>
                       <LabelList dataKey="value" position="right" offset={8} className="fill-foreground" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-5 w-5" />
            <AlertTitle>Understanding Your Results</AlertTitle>
            <AlertDescription>
              These results are estimations based on the provided data and AI analysis. 
              Body fat percentage indicates the proportion of fat in your body. Lean muscle mass is your body weight minus fat. Visceral fat is fat stored around your organs. BMI is a general indicator of body weight relative to height.
              For medical advice, please consult a healthcare professional.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/tracking">
            <Button variant="outline">
              <BarChart3 className="mr-2 h-5 w-5" /> View Progress History
            </Button>
          </Link>
          <Link href="/capture">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <RefreshCw className="mr-2 h-5 w-5" /> Take New Measurements
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
