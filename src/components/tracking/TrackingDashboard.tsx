'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AnalysisResult } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { LineChart, TrendingUp, InfoIcon, CalendarDays, PlusCircle } from 'lucide-react'; // Changed Info to InfoIcon
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, TooltipProps } from "recharts"
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../ui/button';

const chartConfig = {
  bodyFatPercentage: {
    label: "Body Fat %",
    color: "hsl(var(--chart-1))",
  },
  leanMuscleMass: {
    label: "Lean Mass (kg)",
    color: "hsl(var(--chart-2))",
  },
  bmi: {
    label: "BMI",
    color: "hsl(var(--chart-3))",
  },
  visceralFat: {
    label: "Visceral Fat",
    color: "hsl(var(--chart-4))",
  }
} satisfies ChartConfig;

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-background/90 border border-border shadow-lg rounded-lg backdrop-blur-sm">
        <p className="label text-sm font-semibold text-foreground mb-1">{`Date: ${label}`}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }} className="text-xs">
            {`${entry.name}: ${entry.value?.toFixed(1)} ${entry.name === 'Lean Mass (kg)' ? 'kg' : entry.name === 'Body Fat %' ? '%' : ''}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrackingDashboard() {
  const [history, setHistory] = useLocalStorage<AnalysisResult[]>('analysisHistory', []);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formattedHistory = history
    .map(item => ({
      ...item,
      date: new Date(item.date), 
      formattedDate: format(new Date(item.date), 'MMM d, yy'),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime()); 

  if (!isClient) {
    return (
      <Card className="shadow-xl animate-pulse">
        <CardHeader>
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
        </CardHeader>
        <CardContent className="h-[400px] bg-muted/50 rounded-md m-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading historical data...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (formattedHistory.length === 0) {
    return (
      <Card className="w-full max-w-xl mx-auto text-center shadow-xl p-6 md:p-8">
        <CardHeader className="items-center">
          <CalendarDays className="h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-3xl">No Tracking Data Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <Image 
            src="https://picsum.photos/seed/empty-chart-modern/400/250" 
            alt="Empty state illustration showing a stylized chart" 
            width={400} height={250} 
            className="mx-auto rounded-lg mb-6 shadow-md"
            data-ai-hint="modern chart empty" 
          />
          <p className="text-lg text-muted-foreground mb-6">
            Start your wellness journey by capturing your first analysis. We'll help you visualize your progress here.
          </p>
          <Link href="/capture">
            <Button size="lg" className="bg-primary hover:bg-primary/80 text-primary-foreground text-lg py-3 px-8 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              <PlusCircle className="mr-2 h-6 w-6" /> Start First Analysis
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-card to-secondary/20 p-6 md:p-8">
          <CardTitle className="text-4xl font-bold flex items-center text-foreground">
            <LineChart className="mr-3 h-10 w-10 text-primary" />
            Your Progress Journey
          </CardTitle>
          <CardDescription className="text-lg text-foreground/70 mt-1">
            Visualize how your body composition metrics have evolved over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-8">
          <ChartContainer config={chartConfig} className="w-full h-[400px] md:h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedHistory} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                <XAxis 
                  dataKey="formattedDate" 
                  tickLine={false} 
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickMargin={10}
                  tickFormatter={(value) => value}
                  stroke="hsl(var(--foreground) / 0.7)"
                  style={{ fontSize: '0.75rem' }}
                />
                <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-1))"  axisLine={false} tickLine={false} tickMargin={5} style={{ fontSize: '0.75rem' }} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" axisLine={false} tickLine={false} tickMargin={5} style={{ fontSize: '0.75rem' }}/>
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                <ChartLegend content={<ChartLegendContent wrapperStyle={{ paddingTop: '20px' }} />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="bodyFatPercentage"
                  stroke={chartConfig.bodyFatPercentage.color}
                  fill={chartConfig.bodyFatPercentage.color}
                  fillOpacity={0.2}
                  strokeWidth={2.5}
                  name={chartConfig.bodyFatPercentage.label}
                  dot={{ r: 3, fill: chartConfig.bodyFatPercentage.color, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="leanMuscleMass"
                  stroke={chartConfig.leanMuscleMass.color}
                  fill={chartConfig.leanMuscleMass.color}
                  fillOpacity={0.2}
                  strokeWidth={2.5}
                  name={chartConfig.leanMuscleMass.label}
                  dot={{ r: 3, fill: chartConfig.leanMuscleMass.color, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                 <Area // This one will be hidden by default or can be toggled
                  yAxisId="left" 
                  type="monotone"
                  dataKey="bmi"
                  stroke={chartConfig.bmi.color}
                  fill={chartConfig.bmi.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name={chartConfig.bmi.label}
                  hide={formattedHistory.length < 2} // Hide if not enough data for a line
                  dot={{ r: 3, fill: chartConfig.bmi.color, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                 <Area // This one will be hidden by default or can be toggled
                  yAxisId="left" // Potentially use a third axis if scales are very different
                  type="monotone"
                  dataKey="visceralFat"
                  stroke={chartConfig.visceralFat.color}
                  fill={chartConfig.visceralFat.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name={chartConfig.visceralFat.label}
                  hide={formattedHistory.length < 2} // Hide if not enough data for a line
                  dot={{ r: 3, fill: chartConfig.visceralFat.color, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>

          {formattedHistory.length === 1 && (
             <Alert variant="default" className="bg-primary/5 border-primary/20 shadow-sm">
              <TrendingUp className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">One Step at a Time!</AlertTitle>
              <AlertDescription className="text-foreground/80">
                You've recorded your first analysis! Keep tracking your measurements to unlock trend insights and see your progress unfold.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-secondary/50 border-border shadow-sm">
            <InfoIcon className="h-5 w-5 text-foreground/70" />
            <AlertTitle className="font-semibold text-foreground/90">Interpreting Your Trends</AlertTitle>
            <AlertDescription className="text-foreground/70">
              Focus on consistent changes over weeks or months, as short-term fluctuations are normal. Align your observations with your health and fitness goals. Consistency is key to meaningful progress!
            </AlertDescription>
          </Alert>
        </CardContent>
         <CardFooter className="p-6 md:p-8 bg-secondary/20 flex justify-center">
           <Link href="/capture">
            <Button size="lg" className="bg-accent hover:bg-accent/80 text-accent-foreground text-lg py-3 px-8 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                <PlusCircle className="mr-2 h-6 w-6" /> Add New Analysis
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
