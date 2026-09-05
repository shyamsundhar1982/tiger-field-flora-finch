import { groupsetName } from "./groupsets";
export type Model={id:string;tier:"core"|"pro"|"apex";name:string;brand:"Shimano"|"SRAM";groupset:string;wheelset:string;tyres:string;asp:number};
export const MODELS:Model[]=[
{id:"core-tiagra",tier:"core",name:"VINDY Longitude Tiagra",brand:"Shimano",groupset:groupsetName("tiagra"),wheelset:"Performance Alloy",tyres:"Continental Ultra Sport III",asp:111900},
{id:"core-105",tier:"core",name:"VINDY Longitude 105",brand:"Shimano",groupset:"Shimano 105 R7000",wheelset:"Performance Alloy",tyres:"Vittoria Rubino Pro IV",asp:145300},
{id:"core-105-elite",tier:"core",name:"VINDY Longitude 105 Elite",brand:"Shimano",groupset:"Shimano 105 R7000",wheelset:"Light Alloy 30",tyres:"Continental GP5000",asp:158100},
{id:"pro-105-di2",tier:"pro",name:"VINDY Latitude 105 Di2",brand:"Shimano",groupset:groupsetName("105-di2"),wheelset:"3T Carbon CW-3T2",tyres:"Vittoria Rubino Pro IV",asp:215000},
{id:"pro-rival-axs",tier:"pro",name:"VINDY Latitude Rival AXS",brand:"SRAM",groupset:groupsetName("rival-axs"),wheelset:"3T Carbon CW-3T2",tyres:"Vittoria Rubino Pro IV",asp:205000},
{id:"pro-ultegra-di2",tier:"pro",name:"VINDY Latitude Ultegra Di2",brand:"Shimano",groupset:groupsetName("ultegra-di2"),wheelset:"3T Carbon CW-3T2",tyres:"Continental GP5000",asp:255000},
{id:"pro-force-axs",tier:"pro",name:"VINDY Latitude Force AXS",brand:"SRAM",groupset:groupsetName("force-axs"),wheelset:"3T Carbon CW-3T2",tyres:"Continental GP5000",asp:245000},
{id:"apex-ultegra-di2",tier:"apex",name:"VINDY Altitude Ultegra Di2",brand:"Shimano",groupset:groupsetName("ultegra-di2"),wheelset:"Magene EXAR Pro DB58",tyres:"Vittoria Corsa Pro",asp:295000},
{id:"apex-duraace-di2",tier:"apex",name:"VINDY Altitude Dura-Ace Di2",brand:"Shimano",groupset:groupsetName("duraace-di2"),wheelset:"Magene EXAR Pro DB58",tyres:"Vittoria Corsa Pro",asp:395000},
{id:"apex-red-axs",tier:"apex",name:"VINDY Altitude RED AXS",brand:"SRAM",groupset:groupsetName("red-axs"),wheelset:"Magene EXAR Pro DB58",tyres:"Vittoria Corsa Pro",asp:425000},
];
