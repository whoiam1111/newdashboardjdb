import { computeGoals, currentCampaign, parseCampaigns } from '@/lib/goals';
import { readGoalTabs, readSheet } from '@/lib/sheet';
import { requireUser } from '@/lib/user';
import Goals from './Goals';

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
    const user = await requireUser();
    const [{ records }, { settings, goals }] = await Promise.all([readSheet(), readGoalTabs()]);
    const campaigns = parseCampaigns(settings);
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const { month } = await searchParams;
    const campaign = campaigns.find((c) => c.month === month) ?? currentCampaign(campaigns, today);
    // jdb 처럼 이름 없이 점수만 보내므로 모든 지역을 보여준다 (내 지역이 먼저)
    const rows = campaign ? computeGoals(campaign, goals, records) : [];
    return (
        <Goals
            months={campaigns.map((c) => c.month)}
            campaign={campaign ?? null}
            rows={user.region ? [...rows.filter((r) => r.region === user.region), ...rows.filter((r) => r.region !== user.region)] : rows}
            myRegion={user.region}
        />
    );
}
