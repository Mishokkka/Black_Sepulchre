export interface CampaignChoice {
  id: string
  name: string
  side: 'deathwatch' | 'necrons'
}
export const campaignKey = (user: string) => `black-sepulchre:last-campaign:${user}`
export function initialCampaign(choices: CampaignChoice[], remembered: string | null) {
  return choices.some((c) => c.id === remembered)
    ? remembered
    : choices.length === 1
      ? choices[0].id
      : null
}
