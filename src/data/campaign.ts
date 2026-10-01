export type Side = 'necrons' | 'deathwatch'

export const STAGES = [
  { battles:'0–1', armyLimit:500, rosterCap:750, dp:'1 detachment', enhancements:1, field:'44×30"' },
  { battles:'2–3', armyLimit:750, rosterCap:1125, dp:'1 detachment', enhancements:1, field:'44×44"' },
  { battles:'4–5', armyLimit:1000, rosterCap:1500, dp:'2 DP', enhancements:2, field:'44×60"' },
  { battles:'6–7', armyLimit:1250, rosterCap:1875, dp:'2 DP', enhancements:2, field:'44×60"' },
  { battles:'8–9', armyLimit:1500, rosterCap:2250, dp:'2 DP', enhancements:3, field:'44×60"' },
  { battles:'10–11', armyLimit:1750, rosterCap:2625, dp:'3 DP', enhancements:4, field:'44×60"' },
  { battles:'12+', armyLimit:2000, rosterCap:3000, dp:'3 DP', enhancements:4, field:'44×60"' },
] as const

export const ADJACENCY: Record<string,string[]> = {
  A:['B','C'], B:['A','D','G'], C:['A','E','G'], D:['B','F','G'], E:['C','H','G'],
  F:['D','I','G'], G:['B','C','D','E','F','H','I','J'], H:['E','J','G'], I:['F','K','G'],
  J:['H','K','G'], K:['I','J']
}

export const SECTOR_META = {
  A:{name:'Watch Fortress Tenebris',class:'Home Stronghold'},
  B:{name:'Basilica Ossuary',class:'Ordinary'},
  C:{name:'Orbital Ossuary Lift',class:'Strategic Node'},
  D:{name:'Fleshworks IX',class:'Ordinary'},
  E:{name:'Ash Meridian',class:'Strategic Node'},
  F:{name:'Noctis Relay',class:'Strategic Node'},
  G:{name:'Cathedral of Black Glass',class:'Strategic Node'},
  H:{name:'Glass Wastes',class:'Ordinary'},
  I:{name:'Necropolis Khepra',class:'Ordinary'},
  J:{name:'Canoptek Foundry',class:'Strategic Node'},
  K:{name:'Sepulchre of the Nameless King',class:'Home Stronghold'},
} as const

export const MISSIONS = [
 ['A1','Cut the Shield','Прорыв'],['A2','The Long Vigil','Осада'],['A3','Sever the Vigil','Декапитация'],
 ['B1','Reliquary Hunt','Поиск'],['B2','Bone Choir','Контроль'],['B3','Procession of the Dead','Движущаяся цель'],
 ['C1','Falling Sky','Катастрофа'],['C2','Counterweight','Сопровождение'],['C3','Zero-G Breach','Манёвр'],
 ['D1','Vat Breach','Саботаж'],['D2','Harvest Line','Эвакуация'],['D3','Red Conveyor','Зона'],
 ['E1','Armoured Train','Движущаяся цель'],['E2','Break the Rails','Саботаж'],['E3','Black Freight','Лут'],
 ['F1','Kill the Signal','Хак'],['F2','Ghost Frequency','Скрытая цель'],['F3','Last Transmission','Асимметрия'],
 ['G1','Pilgrimage into Glass','Контроль'],['G2','Beneath the Altar','Спуск'],['G3','The Black Choir','Катастрофа'],
 ['H1','Mirror March','Обман'],['H2','Buried in Glass','Поиск'],['H3','Heat Death','Сжимающаяся зона'],
 ['I1','Awakening Pits','Контроль'],['I2','Tomb Street','Удержание'],['I3','Name of the Dead','Сканирование'],
 ['J1','Assembly Line','Контроль'],['J2','Machine Hunger','Движущиеся цели'],['J3','Kill Switch','Таймер'],
 ['K1','Break the Seal','Осада'],['K2','Command Crypt','Осада'],['K3','The Nameless Throne','Финал'],
] as const

export function stageIndexForBattles(b:number){ return b>=12 ? 6 : Math.floor(b/2) }
export function campaignSurcharge(rc:number,cr:number){ return Math.ceil((rc*cr/100)/5)*5 }
export function recoveryCost(rc:number){ return Math.max(10,Math.ceil((rc*.15)/5)*5) }
export function fortifyCost(limit:number){ return Math.ceil((limit*.15)/5)*5 }
export function mobiliseGain(limit:number){ return Math.ceil((limit*.10)/5)*5 }
export function garrisonCaps(limit:number,sectorClass:string,fortified:boolean,penalty=false){
 let initial=sectorClass==='Home Stronghold'?1:sectorClass==='Strategic Node'?.75:.5
 let reserve=sectorClass==='Home Stronghold'?.75:sectorClass==='Strategic Node'?.35:.25
 if(fortified){initial=Math.max(initial,1);reserve=Math.max(reserve,.5)}
 if(penalty)reserve=Math.max(0,reserve-.10)
 return {initial:Math.floor(limit*initial/5)*5,reserve:Math.floor(limit*reserve/5)*5}
}
