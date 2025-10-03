import { chromium } from '@playwright/test';

async function measurePerformance(url, pageName) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate and wait for load
  await page.goto(url, { waitUntil: 'networkidle' });

  // Get performance metrics
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');

    return {
      // Navigation timing
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      domInteractive: navigation.domInteractive,
      domComplete: navigation.domComplete,
      loadComplete: navigation.loadEventEnd,

      // Paint timing
      fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,

      // Resource counts
      resourceCount: performance.getEntriesByType('resource').length,

      // Memory (if available)
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
      } : null
    };
  });

  // Get layout metrics (CLS approximation)
  const layoutShifts = await page.evaluate(() => {
    return new Promise((resolve) => {
      let cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(cls);
      }, 1000);
    });
  });

  await browser.close();

  return {
    page: pageName,
    url,
    metrics: {
      ...metrics,
      cls: layoutShifts,
      // Calculated metrics
      fcp_s: (metrics.fcp / 1000).toFixed(2),
      domInteractive_s: (metrics.domInteractive / 1000).toFixed(2),
      loadComplete_s: (metrics.loadComplete / 1000).toFixed(2),
    }
  };
}

async function runTests() {
  console.log('🚀 Starting Performance Tests...\n');

  const pages = [
    { url: 'http://localhost:3000/', name: 'Landing Page' },
    { url: 'http://localhost:3000/signin', name: 'Sign In' },
    { url: 'http://localhost:3000/signup', name: 'Sign Up' },
  ];

  const results = [];

  for (const page of pages) {
    console.log(`Testing: ${page.name}...`);
    const result = await measurePerformance(page.url, page.name);
    results.push(result);
    console.log(`✅ ${page.name}: FCP=${result.metrics.fcp_s}s, Load=${result.metrics.loadComplete_s}s\n`);
  }

  // Print summary table
  console.log('\n📊 Performance Summary\n');
  console.log('Page'.padEnd(20) + 'FCP (s)'.padEnd(12) + 'DOM Interactive'.padEnd(18) + 'Load Complete'.padEnd(18) + 'CLS'.padEnd(10) + 'Resources');
  console.log('-'.repeat(100));

  for (const result of results) {
    console.log(
      result.page.padEnd(20) +
      result.metrics.fcp_s.padEnd(12) +
      result.metrics.domInteractive_s.padEnd(18) +
      result.metrics.loadComplete_s.padEnd(18) +
      result.metrics.cls.toFixed(3).padEnd(10) +
      result.metrics.resourceCount
    );
  }

  // Save to JSON
  const fs = await import('fs');
  fs.writeFileSync('performance-results.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Results saved to performance-results.json');
}

runTests().catch(console.error);
