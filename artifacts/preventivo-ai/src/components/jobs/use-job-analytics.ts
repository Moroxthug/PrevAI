import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/analytics-api";

/**
 * The job's analytics, shared by the page's number strip and the Overview tab (one request).
 * Its own module (PERF-1) so the job page can load the charts — and recharts,
 * ~110 kB gzip — only after the page has painted.
 */
export const useJobAnalytics = (jobId: string) => useQuery({ queryKey: ["job-analytics", jobId], queryFn: () => analyticsApi.job(jobId) });
