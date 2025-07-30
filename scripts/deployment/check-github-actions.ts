#!/usr/bin/env node

/**
 * 检查 GitHub Actions 运行结果的脚本
 * 使用方法: npx tsx scripts/check-github-actions.ts
 */

async function checkLatestRun() {
  const owner = 'Hyperionxyz';
  const repo = 'notification';
  
  try {
    // 获取最新的 workflow 运行
    const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`;
    const runsResponse = await fetch(runsUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }
    });
    
    if (!runsResponse.ok) {
      console.error('Failed to fetch runs:', runsResponse.status);
      return;
    }
    
    const runsData = await runsResponse.json();
    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      console.log('No workflow runs found');
      return;
    }
    
    const latestRun = runsData.workflow_runs[0];
    console.log('Latest workflow run:');
    console.log(`- ID: ${latestRun.id}`);
    console.log(`- Status: ${latestRun.status}`);
    console.log(`- Conclusion: ${latestRun.conclusion || 'pending'}`);
    console.log(`- Created: ${latestRun.created_at}`);
    console.log(`- URL: ${latestRun.html_url}`);
    
    // 如果运行失败，尝试获取更多信息
    if (latestRun.conclusion === 'failure') {
      console.log('\n❌ Workflow failed. Check the logs at:');
      console.log(latestRun.html_url);
      
      // 获取作业信息
      const jobsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${latestRun.id}/jobs`;
      const jobsResponse = await fetch(jobsUrl, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }
      });
      
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        console.log('\nFailed jobs:');
        jobsData.jobs?.forEach((job: any) => {
          if (job.conclusion === 'failure') {
            console.log(`- ${job.name}: ${job.html_url}`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Error checking GitHub Actions:', error);
  }
}

// 运行检查
checkLatestRun();