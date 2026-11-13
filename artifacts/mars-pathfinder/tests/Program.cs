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
Console.WriteLine($"PASS: {checks} algorithm invariants and fixture checks");
