
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Target, Users, Zap, LineChart as LineChartIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center space-y-16 md:space-y-24">
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_500px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-6 text-left">
              <div className="space-y-3">
                <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl xl:text-7xl/none">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    Unlock
                  </span> Your Body's Potential.
                </h1>
                <p className="max-w-[600px] text-foreground/70 md:text-xl">
                  BodyWise leverages advanced AI for precise body composition analysis.
                  Gain actionable insights, monitor your progress, and achieve peak wellness.
                </p>
              </div>
              <div className="flex flex-col gap-3 min-[400px]:flex-row">
                <Link href="/capture">
                  <Button size="lg" className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg hover:shadow-primary/30 transition-all duration-300 transform hover:scale-105">
                    Start Your Analysis
                    <Zap className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button size="lg" variant="outline" className="shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105">
                    Create Your Profile
                  </Button>
                </Link>
              </div>
            </div>
            <Image
              src="https://picsum.photos/seed/modern-fitness-abstract/600/600"
              alt="Abstract representation of fitness and technology"
              width={600}
              height={600}
              className="mx-auto aspect-square overflow-hidden rounded-2xl object-cover sm:w-full lg:order-last shadow-2xl"
              data-ai-hint="minimalist tech health"
              priority
            />
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-secondary/30">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary tracking-wide">
                Core Capabilities
              </div>
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Empowering Your Health Journey
              </h2>
              <p className="max-w-[900px] text-foreground/70 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our platform combines cutting-edge technology with user-centric design to provide unparalleled body insights.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-stretch gap-8 sm:grid-cols-2 md:gap-10 lg:grid-cols-3 lg:max-w-none">
            {[
              {
                icon: Target,
                title: "AI Pose Guidance",
                description: "Capture flawless photos with our intelligent assistant guiding your posture for pinpoint accuracy.",
                benefit: "Ensures data precision.",
                iconBg: "bg-accent/10",
                iconColor: "text-accent"
              },
              {
                icon: Users,
                title: "Personalized Profile",
                description: "Craft your unique health profile to receive tailored analysis and effectively track your personal journey.",
                benefit: "Insights matched to you.",
                iconBg: "bg-primary/10",
                iconColor: "text-primary"
              },
              {
                icon: LineChartIcon,
                title: "Progress Visualization",
                description: "Observe your body composition evolve over time through intuitive charts and dynamic graphs.",
                benefit: "Monitor your improvements.",
                iconBg: "bg-primary/10", // Re-using primary for visual balance
                iconColor: "text-primary"
              }
            ].map((feature) => (
              <Card key={feature.title} className="shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col">
                <CardHeader className="items-start">
                  <div className={`${feature.iconBg} p-3.5 rounded-xl w-fit mb-3`}>
                    <feature.icon className={`h-8 w-8 ${feature.iconColor}`} />
                  </div>
                  <CardTitle className="text-2xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base text-foreground/70">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                   <p className="text-sm font-medium text-primary flex items-center">
                     <CheckCircle className="h-5 w-5 text-primary inline mr-2"/> {feature.benefit}
                   </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container grid items-center justify-center gap-6 px-4 text-center md:px-6">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl/tight">
              Ready to Discover <span className="text-primary">BodyWise</span> Insights?
            </h2>
            <p className="mx-auto max-w-[700px] text-foreground/70 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Embark on a transformative journey to understand your health and fitness like never before. Get started with a simple scan.
            </p>
          </div>
          <div className="mx-auto w-full max-w-md space-y-2">
            <Link href="/capture">
              <Button size="lg" className="w-full bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg hover:shadow-primary/30 transition-all duration-300 transform hover:scale-105">
                Begin Your Smart Analysis
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
