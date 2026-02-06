import ExplanationSection from "@/components/sections/Explanation";
import HeroSection from "@/components/sections/HeroSection";
import StripePricingTable from "@/components/subscription/StripePricingTable";
import SubscriptionCardContainer from "@/components/subscription/SubscriptionCardContainer";
import fetchStripeProducts from "@/lib/stripe/fetchStripeProducts";

export default async function Home() {
  const { products } = await fetchStripeProducts();

  return (
    <main className="flex min-h-screen flex-col space-y-10 pb-10 items-center justify-between lg:p-4">
      <HeroSection />

      <ExplanationSection />

      {products.length > 0 ? (
        <SubscriptionCardContainer
          products={products}
          salesCall="Save money and time, buy my SaaS app today and you won't regret it!"
        />
      ) : (
        <p>No subscription plans available at the moment.</p>
      )}
    </main>
  );
}
