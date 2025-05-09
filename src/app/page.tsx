
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Target, Users, Zap, LineChart as LineChartIcon } from "lucide-react"; // Renamed LineChart to LineChartIcon to avoid any potential naming conflicts, though the original error was strange.
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center space-y-12">
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4 text-left">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  Understand Your Body, Unlock Your Potential
                </h1>
                <p className="max-w-[600px] text-foreground/80 md:text-xl">
                  BodyWise uses cutting-edge AI to provide detailed body composition analysis.
                  Track your progress, get personalized insights, and achieve your fitness goals.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/capture">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Start Analysis
                    <Zap className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button size="lg" variant="outline">
                    Create Profile
                  </Button>
                </Link>
              </div>
            </div>
            <Image
              src="https://picsum.photos/seed/bodywise-hero/600/600"
              alt="Healthy lifestyle"
              width={600}
              height={600}
              className="mx-auto aspect-square overflow-hidden rounded-xl object-cover sm:w-full lg:order-last"
              data-ai-hint="fitness health"
            />
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                Key Features
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                How BodyWise Empowers You
              </h2>
              <p className="max-w-[900px] text-foreground/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our platform offers a suite of tools designed to give you a comprehensive understanding of your body.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 lg:max-w-none mt-12">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="bg-accent/10 p-3 rounded-md w-fit mb-2">
                  <Target className="h-8 w-8 text-accent" />
                </div>
                <CardTitle>AI Pose Guidance</CardTitle>
                <CardDescription>
                  Capture perfect photos with our AI assistant guiding your pose for accurate analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <CheckCircle className="h-5 w-5 text-primary inline mr-1"/> Ensures data accuracy.
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                 <div className="bg-primary/10 p-3 rounded-md w-fit mb-2">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                <CardTitle>Personalized Profile</CardTitle>
                <CardDescription>
                  Create your unique profile to tailor analysis and track your personal health journey.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CheckCircle className="h-5 w-5 text-primary inline mr-1"/> Tailored to your metrics.
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-md w-fit mb-2"> {/* Changed from green-500 to primary */}
                  <LineChartIcon className="h-8 w-8 text-primary" /> {/* Changed from text-green-500 to text-primary */}
                </div>
                <CardTitle>Progress Tracking</CardTitle>
                <CardDescription>
                  Visualize your body composition changes over time with intuitive charts and graphs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CheckCircle className="h-5 w-5 text-primary inline mr-1"/> {/* Changed from text-green-500 to text-primary */}
                Monitor your improvements.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
              Ready to Discover Your BodyWise Insights?
            </h2>
            <p className="mx-auto max-w-[600px] text-foreground/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Take the first step towards a deeper understanding of your health and fitness.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm space-y-2">
            <Link href="/capture">
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Get Started Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
