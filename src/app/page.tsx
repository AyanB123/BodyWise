
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Target, Users, LineChart as LineChartIcon, CheckCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center space-y-20 md:space-y-32 dark"> {/* Force dark theme for this page based on new design */}
      {/* Hero Section */}
      <section className="w-full pt-20 pb-12 md:pt-32 md:pb-20 lg:pt-40 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://picsum.photos/seed/epic-mountain-mist/1920/1080"
            alt="Abstract representation of misty mountains and technology"
            layout="fill"
            objectFit="cover"
            className="opacity-20 dark:opacity-10"
            data-ai-hint="epic landscape mist"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/50 to-background z-10"></div>
        </div>
        <div className="container relative z-10 px-4 md:px-6 text-center">
          <div className="flex flex-col items-center space-y-8">
            <h1 className="text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl/none">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-amber-400 to-orange-500">
                BodyWise
              </span>
              <br />
              Insight Reimagined.
            </h1>
            <p className="max-w-[700px] text-foreground/75 md:text-xl lg:text-2xl leading-relaxed">
              Experience the future of body analysis. AI-powered precision, stunning visuals, and personalized guidance await.
            </p>
            <div className="flex flex-col gap-4 min-[400px]:flex-row mt-6">
              <Link href="/capture">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/80 text-primary-foreground rounded-full px-10 py-7 text-lg font-semibold shadow-[0_0_20px_hsl(var(--primary)/0.4),0_0_40px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.6),0_0_50px_hsl(var(--primary)/0.3)] transition-all duration-300 transform hover:scale-105"
                >
                  Begin Your Scan
                  <Zap className="ml-2.5 h-6 w-6" />
                </Button>
              </Link>
              <Link href="/profile">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="rounded-full px-10 py-7 text-lg font-semibold border-2 border-primary/50 hover:border-primary hover:bg-primary/10 hover:text-primary shadow-lg hover:shadow-primary/20 transition-all duration-300 transform hover:scale-105"
                >
                  Set Up Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-16 md:py-24 lg:py-32 bg-background"> {/* Changed to bg-background for consistency */}
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-6 text-center mb-16">
            <div className="inline-block rounded-full bg-primary/10 px-5 py-2.5 text-md font-semibold text-primary tracking-wide shadow-md">
              Core Capabilities
            </div>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Unlock Your Potential
            </h2>
            <p className="max-w-[900px] text-foreground/70 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Our platform fuses sophisticated AI with an intuitive experience, offering unparalleled insights into your physique.
            </p>
          </div>
          <div className="mx-auto grid max-w-7xl items-stretch gap-8 md:gap-10 lg:grid-cols-3">
            {[
              {
                icon: Sparkles, // Changed icon
                title: "AI Pose Guidance",
                description: "Capture perfect photos with our smart assistant, ensuring posture precision for accurate analysis.",
                benefit: "Flawless data capture.",
                iconBg: "bg-primary/10",
                iconColor: "text-primary"
              },
              {
                icon: Users,
                title: "Personalized Profile",
                description: "Build your unique health identity for tailored analysis and effective tracking of your wellness journey.",
                benefit: "Insights crafted for you.",
                iconBg: "bg-primary/10",
                iconColor: "text-primary"
              },
              {
                icon: LineChartIcon,
                title: "Progress Visualization",
                description: "Witness your body's transformation through sleek, dynamic charts and intuitive progress reports.",
                benefit: "Track your evolution.",
                iconBg: "bg-primary/10", 
                iconColor: "text-primary"
              }
            ].map((feature) => (
              <Card 
                key={feature.title} 
                className="bg-card/80 backdrop-blur-sm border-border/30 rounded-3xl shadow-2xl shadow-black/30 hover:shadow-primary/20 transition-all duration-300 transform hover:-translate-y-2 flex flex-col overflow-hidden"
              >
                <CardHeader className="items-start p-8">
                  <div className={`${feature.iconBg} p-4 rounded-2xl w-fit mb-4 shadow-inner`}>
                    <feature.icon className={`h-10 w-10 ${feature.iconColor}`} />
                  </div>
                  <CardTitle className="text-3xl font-semibold">{feature.title}</CardTitle>
                  <CardDescription className="text-lg text-foreground/60 mt-1">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto p-8 pt-0">
                   <p className="text-md font-medium text-primary flex items-center">
                     <CheckCircle className="h-6 w-6 text-primary inline mr-2.5"/> {feature.benefit}
                   </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-16 md:py-24 lg:py-32">
        <div className="container grid items-center justify-center gap-8 px-4 text-center md:px-6">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl/tight lg:text-6xl">
              Ready to Discover <span className="text-primary">BodyWise</span>?
            </h2>
            <p className="mx-auto max-w-[700px] text-foreground/70 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Embark on a transformative journey. Understand your health and fitness like never before. Start with a simple, guided scan.
            </p>
          </div>
          <div className="mx-auto w-full max-w-md space-y-2 mt-6">
            <Link href="/capture">
              <Button 
                size="lg" 
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground rounded-full px-10 py-7 text-lg font-semibold shadow-[0_0_20px_hsl(var(--primary)/0.4),0_0_40px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.6),0_0_50px_hsl(var(--primary)/0.3)] transition-all duration-300 transform hover:scale-105"
              >
                Start Smart Analysis
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
