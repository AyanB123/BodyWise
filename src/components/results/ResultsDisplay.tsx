'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { UserProfile, AnalysisResult } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import Link from 'next/link';
import Image from 'next/image';
import { Award, BarChart3, HeartPulse, InfoIcon, RefreshCw, FileWarning, UserCircle2 } from 'lucide-react'; // Changed Info to InfoIcon
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts"

const chartConfig = {
  bodyFat: { label: "Body Fat %", color: "hsl(var(--chart-1))" },
  leanMass: { label: "Lean Mass (kg)", color: "hsl(var(--chart-2))" },
  visceralFat: { label: "Visceral Fat", color: "hsl(var(--chart-3))" }, // Unit: Level or Index
  bmi: { label: "BMI", color: "hsl(var(--chart-4))"},
} satisfies ChartConfig


export default function ResultsDisplay() {
  const [profile] = useLocalStorage<UserProfile | null>('userProfile', null);
  const [results, setResults] = useLocalStorage<AnalysisResult | null>('latestAnalysisResult', null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const calculateMockResults = () => {
      if (!profile || !profile.weight || !profile.height || !profile.age) {
        setResults(null);
        setIsLoading(false);
        return;
      }
      const heightM = Number(profile.height) / 100;
      const weightKg = Number(profile.weight);
      const age = Number(profile.age);
      const bmi = weightKg / (heightM * heightM);

      // Mock values - these would come from a real analysis engine
      let bodyFatPercentage = (bmi * 0.7) + (age * 0.15) + (Math.random() * 5 - 2.5); // Simplified mock
      bodyFatPercentage = Math.max(5, Math.min(50, bodyFatPercentage)); // Bound body fat

      const leanMuscleMass = weightKg * (1 - bodyFatPercentage / 100);
      const visceralFat = Math.round((bmi / 5) + (Math.random() * 2) + 1); // Mock value, typically an index 1-15

      const newResult: AnalysisResult = {
        id: new Date().toISOString(),
        date: new Date().toISOString(),
        bodyFatPercentage: parseFloat(bodyFatPercentage.toFixed(1)),
        visceralFat: parseFloat(visceralFat.toFixed(1)),
        leanMuscleMass: parseFloat(leanMuscleMass.toFixed(1)),
        bmi: parseFloat(bmi.toFixed(1)),
      };
      setResults(newResult);

      const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]') as AnalysisResult[];
      const updatedHistory = [newResult, ...history.slice(0, 19)]; // Keep last 20
      localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
      
      setIsLoading(false);
    };

    const timer = setTimeout(calculateMockResults, 1200); // Slightly faster mock calculation
    return () => clearTimeout(timer);
  }, [profile, setResults]);


  const MetricCard = ({ title, value, unit, icon: Icon, colorClass = "text-primary", description }: { title: string, value: string | number, unit?: string, icon: React.ElementType, colorClass?: string, description?: string }) => (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-md font-semibold text-foreground/80">{title}</CardTitle>
        <Icon className={`h-6 w-6 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold text-foreground">{value}{unit && <span className="text-2xl text-muted-foreground ml-1">{unit}</span>}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-2xl text-muted-foreground font-medium">Calculating Your Analysis...</p>
        <p className="text-md text-muted-foreground">This won't take long.</p>
      </div>
    );
  }

  if (!profile || !profile.weight || !profile.height || !profile.age) {
    return (
      <Card className="w-full max-w-xl mx-auto text-center shadow-xl p-6 md:p-8">
        <CardHeader className="items-center">
           <UserCircle2 className="h-16 w-16 text-destructive mb-4" />
          <CardTitle className="text-3xl text-destructive">Profile Incomplete</CardTitle>
        </CardHeader>
        <CardContent>
          <Image src="https://picsum.photos/seed/profile-incomplete-modern/400/250" alt="Profile illustration" width={400} height={250} className="mx-auto rounded-lg mb-6 shadow-md" data-ai-hint="modern illustration profile" />
          <p className="text-lg text-muted-foreground mb-6">
            Please complete your profile (height, weight, age) to view your body composition analysis.
          </p>
          <Link href="/profile">
            <Button size="lg" className="bg-primary hover:bg-primary/80 text-primary-foreground text-lg py-3 px-8 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              Go to Profile
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  
  if (!results) {
     return (
      <Card className="w-full max-w-xl mx-auto text-center shadow-xl p-6 md:p-8">
        <CardHeader className="items-center">
          <FileWarning className="h-16 w-16 text-accent mb-4" />
          <CardTitle className="text-3xl">No Results Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <Image src="https://picsum.photos/seed/no-results-modern/400/250" alt="Analysis illustration" width={400} height={250} className="mx-auto rounded-lg mb-6 shadow-md" data-ai-hint="abstract data science" />
          <p className="text-lg text-muted-foreground mb-6">
            It seems we couldn't generate your results. This might be due to incomplete photo capture or a temporary issue.
          </p>
          <Link href="/capture">
            <Button size="lg" className="bg-primary hover:bg-primary/80 text-primary-foreground text-lg py-3 px-8 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              Start Photo Capture
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { metric: "Body Fat", value: results.bodyFatPercentage, unit: "%", fill: "var(--color-bodyFat)"},
    { metric: "Lean Mass", value: results.leanMuscleMass, unit: "kg", fill: "var(--color-leanMass)" },
    { metric: "Visceral Fat", value: results.visceralFat, unit: "Level", fill: "var(--color-visceralFat)" },
    { metric: "BMI", value: results.bmi, unit: "", fill: "var(--color-bmi)" },
  ];


  return (
    <div className="space-y-10">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-card to-secondary/20 p-6 md:p-8">
          <CardTitle className="text-4xl font-bold flex items-center text-foreground">
            <Award className="mr-3 h-10 w-10 text-accent" />
            Your Body Composition
          </CardTitle>
          <CardDescription className="text-lg text-foreground/70 mt-1">
            Analysis Date: {new Date(results.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricCard title="Body Fat Percentage" value={results.bodyFatPercentage} unit="%" icon={BarChart3} colorClass="text-primary" description="Total fat relative to body weight." />
            <MetricCard title="Lean Muscle Mass" value={results.leanMuscleMass} unit="kg" icon={BarChart3} colorClass="text-accent" description="Weight of your muscles and organs." />
            <MetricCard title="Visceral Fat Level" value={results.visceralFat} unit="" icon={HeartPulse} colorClass="text-destructive" description="Fat stored around internal organs (index)." />
            <MetricCard title="Body Mass Index (BMI)" value={results.bmi} unit="" icon={BarChart3} colorClass="text-yellow-500" description="Weight relative to height." />
          </div>

          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-2xl">Metrics Overview</CardTitle>
              <CardDescription>Visual breakdown of your key body composition metrics.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ChartContainer config={chartConfig} className="w-full h-[350px] sm:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }} barCategoryGap="20%">
                    <CartesianGrid horizontal={true} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                    <XAxis type="number" stroke="hsl(var(--foreground) / 0.7)" />
                    <YAxis dataKey="metric" type="category" tickLine={false} axisLine={false} width={120} stroke="hsl(var(--foreground) / 0.7)" style={{ fontSize: '0.875rem' }} />
                    <ChartTooltip 
                        cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} 
                        content={<ChartTooltipContent indicator="dot" />} 
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                       <LabelList 
                          dataKey="value" 
                          position="right" 
                          offset={10} 
                          className="fill-foreground font-medium" 
                          fontSize={14}
                          formatter={(value: number, props: any) => `${value}${props.payload.unit ? ' ' + props.payload.unit : ''}`}
                        />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Alert className="bg-primary/5 border-primary/20 shadow-sm">
            <InfoIcon className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Understanding Your Results</AlertTitle>
            <AlertDescription className="text-foreground/80">
              These results are AI-driven estimations. Body fat percentage indicates total fat. Lean muscle mass is non-fat body weight. Visceral fat (typically an index) relates to fat around organs. BMI is a general weight-to-height ratio. For medical advice, always consult a healthcare professional.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="p-6 md:p-8 bg-secondary/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/tracking" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full text-lg shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105">
              <BarChart3 className="mr-2 h-5 w-5" /> View Progress History
            </Button>
          </Link>
          <Link href="/capture" className="w-full sm:w-auto">
            <Button size="lg" className="w-full text-lg bg-primary hover:bg-primary/80 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              <RefreshCw className="mr-2 h-5 w-5" /> Take New Measurements
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
