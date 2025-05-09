'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AnalysisResult } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { LineChart, TrendingUp, Info, CalendarDays } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../ui/button';

const chartConfig = {
  bodyFatPercentage: {
    label: "Body Fat %",
    color: "hsl(var(--primary))",
  },
  leanMuscleMass: {
    label: "Lean Mass (kg)",
    color: "hsl(var(--accent))",
  },
  bmi: {
    label: "BMI",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export default function TrackingDashboard() {
  const [history, setHistory] = useLocalStorage<AnalysisResult[]>('analysisHistory', []);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formattedHistory = history
    .map(item => ({
      ...item,
      date: new Date(item.date), // Ensure date is a Date object
      formattedDate: format(new Date(item.date), 'MMM d'),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort by date ascending

  if (!isClient) {
    // Render placeholder or loading state for SSR/initial client render
    return (
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center"><LineChart className="mr-3 h-8 w-8 text-primary" />Your Progress</CardTitle>
          <CardDescription>Loading your historical data...</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <p>Loading chart...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (formattedHistory.length === 0) {
    return (
      <Card className="w-full max-w-lg mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center justify-center"><CalendarDays className="mr-3 h-8 w-8 text-primary" />No Tracking Data Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <Image src="https://picsum.photos/seed/no-data/300/200" alt="Empty state illustration" width={300} height={200} className="mx-auto rounded-md mb-4" data-ai-hint="data chart empty" />
          <p className="text-muted-foreground mb-4">
            You haven't recorded any analysis results yet. Capture your first set of measurements to start tracking your progress!
          </p>
          <Link href="/capture">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Start First Analysis</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center"><LineChart className="mr-3 h-8 w-8 text-primary" />Your Progress Over Time</CardTitle>
          <CardDescription>
            Visualize how your body composition metrics have changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ChartContainer config={chartConfig} className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedHistory} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="formattedDate" 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={8}
                  tickFormatter={(value) => value}
                />
                <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" />
                <ChartTooltip
                  cursor={true}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="bodyFatPercentage"
                  stroke={chartConfig.bodyFatPercentage.color}
                  fill={chartConfig.bodyFatPercentage.color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                  name="Body Fat %"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="leanMuscleMass"
                  stroke={chartConfig.leanMuscleMass.color}
                  fill={chartConfig.leanMuscleMass.color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                  name="Lean Mass (kg)"
                />
                 <Area
                  yAxisId="left" // Can share axis or use a third one
                  type="monotone"
                  dataKey="bmi"
                  stroke={chartConfig.bmi.color}
                  fill={chartConfig.bmi.color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  name="BMI"
                  hide // Optionally hide if too cluttered, or use a separate chart
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>

          {formattedHistory.length < 2 && (
             <Alert variant="default" className="bg-blue-500/10 border-blue-500/30">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <AlertTitle className="text-blue-700">Keep Tracking!</AlertTitle>
              <AlertDescription>
                You have one data point. Continue tracking your measurements over time to see trends and insights.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-5 w-5" />
            <AlertTitle>Interpreting Trends</AlertTitle>
            <AlertDescription>
              Look for consistent changes over weeks or months. Short-term fluctuations are normal. 
              Focus on the overall direction of your metrics in line with your health and fitness goals.
              Remember, consistency is key!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
