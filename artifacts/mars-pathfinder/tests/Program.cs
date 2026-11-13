using Backend.Models;
using Backend.Business;
using Mars;
using System.Text.Json;
int checks=0;
void Check(bool ok,string msg){if(!ok)throw new Exception(msg);checks++;}
foreach(var fixture in new[]{"weighted","tie","unreachable","same-point","zero-cost"}){
 var(g,s,e)=LabService.Fixture(fixture);
 var bfs=ShortestPathAlgorithms.FindShortestPathBFS(g,s,e);
 var dj=TheSafestPathsAlgorithms.TheSafestPathDijkstra(g,s,e);
 var astar=TheSafestPathsAlgorithms.FindPathAStar(g,s,e);
 foreach(var r in new[]{bfs,dj,astar}){
  Check(r.Path.All(p=>!g[p.Row][p.Col].Blocked),"Blocked cell in path");
  Check(r.TotalCost==AlgorithmsCommon.CalculatePathCost(g,r.Path),"Entered-cell cost mismatch");
  if(fixture=="unreachable")Check(r.Path.Count==0,"Unreachable");
  if(fixture=="same-point")Check(r.Path.Count==1&&r.TotalCost==0,"Start=destination");
  if(fixture=="zero-cost")Check(r.TotalCost==0,"Zero-cost");
 }
 Check(dj.TotalCost==astar.TotalCost,"Weighted objective mismatch");
 if(fixture=="weighted"){Check(bfs.TotalCost==101&&bfs.Path.Count==7,"BFS regression");Check(dj.TotalCost==8&&dj.Path.Count==9,"Dijkstra regression");}
 if(fixture=="tie")Check(bfs.Path.All(p=>p.Row==2),"BFS tie order");
}
var ns=AlgorithmsCommon.GetNeighbors(new Point{Row=1,Col=1},3,3).Select(p=>$"{p.Row},{p.Col}");
Check(string.Join(";",ns)=="0,1;1,2;2,1;1,0","Neighbor ordering");
var (grid,start,end)=LabService.Fixture("weighted");
grid[2][0].Blocked=true;
try{ShortestPathAlgorithms.FindShortestPathBFS(grid,start,end);throw new Exception("Blocked start accepted");}catch(ArgumentException){checks++;}
grid[2][0].Blocked=false;grid[0][0].DF=-1;
try{TheSafestPathsAlgorithms.FindPathAStar(grid,start,end);throw new Exception("Negative cost accepted");}catch(ArgumentException){checks++;}
JsonElement Geology(string description)=>JsonSerializer.SerializeToElement(new{UnitDesc=description,_source=new{filename="fixture-geology.shp",layer="SIM3292_Global_Geology",featureId=1}});
JsonElement Structure(string category)=>JsonSerializer.SerializeToElement(new{Interpreta=category,_source=new{filename="fixture-structure.shp",layer="SIM3292_Global_Structure",featureId=2}});
var score=RiskService.Combine([Geology("Late Hesperian basin unit")],[Structure("Scarp")]);
Check(Math.Abs(score.RiskScore-66)<1e-10,"Worked example R=66");
Check(Math.Abs(score.MovementCost-1.66)<1e-10&&score.ModelSafetyScore==34,"Cost and inverse score");
Check(score.Factors.Sum(x=>x.Weight)==100,"Weight total");
Check(score.Factors.Sum(x=>x.Contribution)==score.RiskScore,"Factor contributions");
Check(score.Evidence.Length==2&&score.Unknowns.Length==7,"Traceable evidence and unknowns");
var empty=RiskService.Combine([],[]);
Check(!empty.GeologyCovered&&empty.Unknowns.Length==8,"Missing geology is excluded");
Check(empty.Factors.Single(x=>x.Id=="uncertainty").RawScore==1,"Missing input penalty");
Check(empty.Factors.Single(x=>x.Id=="terrain").RawScore==1,"No zero-risk missing terrain");
Check(RiskService.TerrainScore("unknown mystery")==1,"Unmatched terrain precaution");
Check(RiskService.TerrainScore("polar edifice")==1,"First-match terrain ordering");
Check(RiskService.TerrainScore("volcanic edifice")==.8,"Edifice before volcanic");
Check(RiskService.StructureScore("unrecognized")==1,"Unknown structure precaution");
var multi=RiskService.Combine([Geology("basin"),Geology("polar")],[Structure("Lobate flow"),Structure("Scarp")]);
Check(multi.RiskScore==97.5,"Maximum factors, not sum of overlapping features");
var duplicate=RiskService.Combine([Geology("basin"),Geology("basin")],[]);
Check(duplicate.RiskScore==31,"Duplicate evidence does not inflate risk");
foreach(var t in new[]{"basin","polar","apron","massif","highland","volcanic","unmatched"})
 foreach(var m in new[]{"Scarp","Ridge","Lobate flow","unknown"}) {
  var a=RiskService.Combine([Geology(t)],[Structure(m)]);
  Check(a.RiskScore>=0&&a.RiskScore<=100&&a.MovementCost>=1&&a.MovementCost<=2,"Bounded finite scores");
 }
try{GridService.Validate(new GridInput(10,-10,0,1,5,5));throw new Exception("Reversed grid accepted");}catch(ArgumentException){checks++;}
Console.WriteLine($"PASS: {checks} algorithm, risk formula and input checks");
