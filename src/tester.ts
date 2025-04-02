import { MultiTerminalDisplay } from '@sker/terminal'
import { setTimeout as sleep } from 'timers/promises'
// 使用示例
async function demo() {
  const display = new MultiTerminalDisplay({
    width: 40,
    height: 6,
    margin: 2
  });

  const agents = [
    { name: 'Data Processor', tokensUsed: 0, lastText: `Data Processor Data Processor Data Processor Data Processor Data Processor ` },
    { name: 'AI Analyzer', tokensUsed: 0, lastText: `AI Analyzer AI Analyzer AI Analyzer AI Analyzer AI Analyzer AI Analyzer AI Analyzer ` },
    { name: 'Response Generator', tokensUsed: 0, lastText: `Response Generator Response Generator Response Generator Response Generator ` },
    { name: 'Task Scheduler', tokensUsed: 0, lastText: `Task Scheduler Task Scheduler Task Scheduler Task Scheduler Task Scheduler ` }
  ];

  agents.forEach(agent => {
    display.updateAgent({
      ...agent,
      lastUpdated: new Date()
    });
  });

  display.startAutoRender();

  for (let i = 0; i < 20; i++) {
    await sleep(800);
    const randomAgent = agents[Math.floor(Math.random() * agents.length)];
    const increment = Math.floor(Math.random() * 500);

    display.updateAgent({
      name: randomAgent.name,
      tokensUsed: randomAgent.tokensUsed + increment,
      lastUpdated: new Date(),
      lastText: randomAgent.lastText
    });

    randomAgent.tokensUsed += increment;
  }

  await sleep(2000);
  display.stopAutoRender();
  display.clear();
}

demo().catch(console.error);