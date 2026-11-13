using Backend.Models;
using Backend.Business;
namespace Mars;
public record LabInput(string Algorithm,string Fixture);
public class LabService {
    public static (Cell[][] grid,Point start,Point end) Fixture(string name) {
        if (!new[]{"weighted","tie","unreachable","same-point","zero-cost"}.Contains(name)) throw new ArgumentException("Unknown fixture");
        var grid=Enumerable.Range(0,5).Select(r=>Enumerable.Range(0,7).Select(c=>new Cell {Row=r,Col=c,Id=r*7+c,DF=name=="zero-cost"?0:1,SafetyScore=50,Blocked=false}).ToArray()).ToArray();
        if(name=="weighted") for(int c=1;c<6;c++) grid[2][c].DF=20;
        if(name=="unreachable") for(int r=0;r<5;r++) grid[r][3].Blocked=true;
        return (grid,new Point{Row=2,Col=0},new Point{Row=2,Col=name=="same-point"?0:6});
    }
    public object Run(LabInput input) {
        var (grid,start,end)=Fixture(input.Fixture);
        var result=input.Algorithm switch {
            "bfs"=>ShortestPathAlgorithms.FindShortestPathBFS(grid,start,end),
            "dijkstra"=>TheSafestPathsAlgorithms.TheSafestPathDijkstra(grid,start,end),
            "astar"=>TheSafestPathsAlgorithms.FindPathAStar(grid,start,end),
            _=>throw new ArgumentException("Unknown algorithm")
        };
        return new {algorithm=input.Algorithm,fixture=input.Fixture,synthetic=true,rows=5,columns=7,
            cells=grid.SelectMany(x=>x).Select(c=>new{row=c.Row,col=c.Col,df=c.DF,blocked=c.Blocked}),
            path=result.Path,totalCost=result.TotalCost,avgSafetyScore=result.AvgSafetyScore,minSafetyScore=result.MinSafetyScore,
            visitedPathCells=result.Path.Count,found=result.Path.Count>0,warning="Synthetic deterministic test inputs, not Mars measurements. Cost has no physical unit. Path cells are not expanded-node counts."};
    }
}
