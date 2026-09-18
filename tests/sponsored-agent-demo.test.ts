import {describe,expect,it} from 'vitest';
import {sponsoredAgentDemoPage} from '../src/ui';

describe('Sponsored Agent demo page',()=>{
  const page=()=>sponsoredAgentDemoPage();

  it('labels the experience as a demo rather than a live provider integration',()=>{
    const html=page();
    expect(html).toContain('Concept demo · not a live provider integration');
    expect(html).toContain('DEMO MODE');
    expect(html).toContain('does not create, activate or claim access to a live OpenAI Sponsored Agent');
  });

  it('explains the Demo -> Ready -> Live delivery model',()=>{
    const html=page();
    for(const label of ['1 · DEMO','2 · READY','3 · LIVE'])expect(html).toContain(label);
    expect(html).toContain('waiting on the provider');
  });

  it('shows concrete sales-agent capabilities',()=>{
    const html=page();
    for(const copy of [
      'Answer real questions',
      'Use live business facts',
      'Take the next step',
      'Stay on brand',
      'Test before customers see it',
      'Measure outcomes'
    ])expect(html).toContain(copy);
  });

  it('includes an interactive simulated buyer journey',()=>{
    const html=page();
    expect(html).toContain('id="sponsoredDemoMessages"');
    expect(html).toContain('Waterproof shoes under £150');
    expect(html).toContain('Can I get them by Friday?');
    expect(html).toContain('What if they don\'t fit?');
    expect(html).toContain('Take me to checkout');
    expect(html).toContain("querySelectorAll('.demoPrompt')");
  });
});
