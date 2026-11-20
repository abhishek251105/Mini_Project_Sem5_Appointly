export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatPrice(priceInPaise: number, currency: string = "INR"): string {
  if (!priceInPaise || priceInPaise <= 0) {
    return "Free";
  }

  const amount = priceInPaise / 100;

  if (currency === "INR") {
    return `₹${amount.toLocaleString("en-IN")}`;
  }

  return `${currency} ${amount.toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} mins`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${hours}h ${remainingMins}m`;
}
