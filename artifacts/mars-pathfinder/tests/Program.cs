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
ScientificGrid ScenarioGrid(int rows=5,int cols=5,double size=1) {
 var bounds=new GridInput(-rows*size/2,rows*size/2,-cols*size/2,cols*size/2,rows,cols);
 var cells=Enumerable.Range(0,rows).SelectMany(row=>Enumerable.Range(0,cols).Select(col=>{
  var a=RiskService.Combine([Geology("basin")],[]);
  return new ScientificCell(row,col,bounds.StartLat+(row+.5)*size,bounds.StartLng+(col+.5)*size,size,size,"experimental",null,a.MovementCost,a.ModelSafetyScore,["basin"],a);
 })).ToArray();
 return new(rows,cols,cells,RiskService.Warning,bounds);
}
var baseline=ScenarioGrid();
var ev=new HazardEventSpec(2,2,"terrain",.2);
var scenario=HazardService.Apply(baseline,ev);
Check(scenario.Changes.Length==9,"Only origin plus eight neighbors change");
var origin=scenario.Changes.Single(c=>c.Origin);
Check(Math.Abs(origin.DeltaDf-.09)<1e-12,"Origin added DF follows factor weight");
Check(scenario.Changes.Where(c=>!c.Origin).All(c=>c.DeltaDf>0&&c.DeltaDf<origin.DeltaDf),"Residual added DF strictly smaller");
Check(Math.Abs(HazardService.Residual(.2,10000,1,0)-.05)<1e-12,"Worked residual example");
Check(Math.Abs(HazardService.Residual(.2,10000,1,1)-.05/Math.Sqrt(2))<1e-12,"Diagonal attenuation");
Check(HazardService.Residual(.2,100,1,0)>HazardService.Residual(.2,10000,1,0),"Larger area means smaller residual");
Check(HazardService.Residual(.2,10000,2,0)==0,"No propagation beyond ring");
Check(Math.Abs(baseline.Cells[12].Df-1.31)<1e-12,"Baseline grid remains immutable");
Check(scenario.Grid.Cells[0]==baseline.Cells[0],"Non-neighbor cells unchanged");
Check(HazardService.Apply(baseline,new(0,0,"structure",.25)).Changes.Length==4,"Corner has at most three neighbors");
foreach(var c in scenario.Grid.Cells) {
 var before=baseline.Cells[c.Row*baseline.Columns+c.Col];
 Check(c.Blocked==null&&c.Assessment.GeologyCovered==before.Assessment.GeologyCovered,"Simulation does not invent obstacles/coverage");
 Check(c.Assessment.Factors.Single(f=>f.Id=="uncertainty")==before.Assessment.Factors.Single(f=>f.Id=="uncertainty"),"Uncertainty preserved");
 Check(c.Assessment.Evidence.SequenceEqual(before.Assessment.Evidence),"Source evidence preserved");
 Check(c.Assessment.Unknowns.SequenceEqual(before.Assessment.Unknowns),"Unknown physical inputs preserved");
 Check(c.Assessment.Factors.All(f=>f.RawScore>=0&&f.RawScore<=1)&&c.Df<=2,"Factors and cost bounded");
 Check(Math.Abs(c.Df-(1+c.Assessment.Factors.Sum(f=>f.Contribution)/100))<1e-12,"Every scenario cell uses exact formula");
}
var replayed=HazardService.ApplyHistory(baseline,[ev]);
Check(replayed.Cells.Select(c=>c.Df).SequenceEqual(scenario.Grid.Cells.Select(c=>c.Df)),"History replay reproduces grid");
var smaller=HazardService.Apply(ScenarioGrid(size:.1),ev);
Check(smaller.Changes.Single(c=>c.Row==2&&c.Col==3).DeltaDf>scenario.Changes.Single(c=>c.Row==2&&c.Col==3).DeltaDf,"Grid cell size changes residual");
var nearCap=HazardService.ApplyHistory(baseline,[new(2,2,"structure",.25),new(2,2,"structure",.25),new(2,2,"structure",.25)]);
var capped=HazardService.Apply(nearCap,new(2,3,"structure",.25));
Check(capped.Grid.Cells.All(c=>c.Assessment.Factors.Single(f=>f.Id=="structure").RawScore<=1),"Neighbors cap at one");
foreach(var invalid in new[]{new HazardEventSpec(2,2,"terrain",double.NaN),new(2,2,"terrain",.3),new(2,2,"terrain",0),new(-1,2,"terrain",.1),new(2,2,"uncertainty",.1)}) {
 try{HazardService.Apply(baseline,invalid);throw new Exception("Invalid event accepted");}catch(ArgumentException){checks++;}
}
try{HazardService.ApplyHistory(baseline,Enumerable.Repeat(ev,51).ToArray());throw new Exception("Unbounded history");}catch(ArgumentException){checks++;}
var absent=baseline with { Cells=(ScientificCell[])baseline.Cells.Clone() };
absent.Cells[12]=absent.Cells[12] with { Assessment=empty };
try{HazardService.Apply(absent,ev);throw new Exception("Missing geology origin accepted");}catch(ArgumentException){checks++;}
Check(HazardService.Apply(absent,new(2,1,"terrain",.1)).Changes.All(c=>c.Row!=2||c.Col!=2),"Missing coverage neighbor excluded");
Console.WriteLine($"PASS: {checks} algorithm, risk, scenario and input checks");
