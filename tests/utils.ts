export async function sleepWithDetails(
  seconds: number,
  beforeMessage?: string,
  afterMessage?: string
): Promise<void> {
  const startTime = new Date();

  if (beforeMessage) {
    console.log(`[${startTime.toISOString()}] ${beforeMessage}`);
  } else {
    console.log(`[${startTime.toISOString()}] Sleeping for ${seconds} seconds...`);
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      const endTime = new Date();
      if (afterMessage) {
        console.log(`[${endTime.toISOString()}] ${afterMessage}`);
      } else {
        console.log(`[${endTime.toISOString()}] Sleep completed after ${seconds} seconds`);
      }
      resolve();
    }, seconds * 1000);
  });
}
