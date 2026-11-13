using Backend.Models;
using Backend.Business;
namespace Mars;
public record ScientificCell(int Row,int Col,double CenterLat,double CenterLng,double Width,double Height,string SafetyStatus,bool? Blocked,double Df,double SafetyScore,string[] Units,RiskAssessment Assessment);
public record ScientificGrid(int Rows,int Columns,ScientificCell[] Cells,string Warning,GridInput Bounds);
public class GridService(RiskService risk) {
    public static void Validate(GridInput r) {
        if(r==null||r.Rows<1||r.Rows>80||r.Columns<1||r.Columns>80||
            !Valid(r.StartLat,r.StartLng)||!Valid(r.EndLat,r.EndLng)||r.StartLat>=r.EndLat||r.StartLng>=r.EndLng)
            throw new ArgumentException("Use 1–80 rows/columns and increasing valid geographic bounds; longitude seam wrapping is unsupported.");
    }
    public static bool Valid(double lat,double lon)=>double.IsFinite(lat)&&double.IsFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
    public ScientificGrid Generate(GridInput r) {
        Validate(r);
        double h=(r.EndLat-r.StartLat)/r.Rows,w=(r.EndLng-r.StartLng)/r.Columns;
        var cells=Enumerable.Range(0,r.Rows).SelectMany(row=>Enumerable.Range(0,r.Columns).Select(col=>{
            double lat=r.StartLat+(row+.5)*h,lon=r.StartLng+(col+.5)*w;
            var a=risk.Assess(lat,lon,w,h);
            return new ScientificCell(row,col,lat,lon,w,h,"experimental",null,a.MovementCost,a.ModelSafetyScore,
                a.Evidence.Where(e=>e.Layer=="SIM3292_Global_Geology").Select(e=>e.Value).ToArray(),a);
        })).ToArray();
        return new(r.Rows,r.Columns,cells,RiskService.Warning,r);
    }
    public object Route(RouteInput r) {
        var g=Generate(r.Grid);
        Point Snap(double lat,double lon) {
            if(!Valid(lat,lon)||lat<r.Grid.StartLat||lat>r.Grid.EndLat||lon<r.Grid.StartLng||lon>r.Grid.EndLng)
                throw new ArgumentException("Both endpoints must lie inside the generated grid. Adjust bounds and regenerate.");
            return new Point{Row=Math.Min(g.Rows-1,(int)((lat-r.Grid.StartLat)/(r.Grid.EndLat-r.Grid.StartLat)*g.Rows)),
                Col=Math.Min(g.Columns-1,(int)((lon-r.Grid.StartLng)/(r.Grid.EndLng-r.Grid.StartLng)*g.Columns))};
        }
        var start=Snap(r.StartLat,r.StartLng);var end=Snap(r.EndLat,r.EndLng);
        var input=Enumerable.Range(0,g.Rows).Select(row=>g.Cells.Skip(row*g.Columns).Take(g.Columns).Select(c=>new Cell{
            Row=c.Row,Col=c.Col,CenterLat=c.CenterLat,CenterLng=c.CenterLng,DF=c.Df,SafetyScore=c.SafetyScore,
            Blocked=!c.Assessment.GeologyCovered
        }).ToArray()).ToArray();
        var result=r.Algorithm switch{
            "bfs"=>ShortestPathAlgorithms.FindShortestPathBFS(input,start,end),
            "dijkstra"=>TheSafestPathsAlgorithms.TheSafestPathDijkstra(input,start,end),
            "astar"=>TheSafestPathsAlgorithms.FindPathAStar(input,start,end),
            _=>throw new ArgumentException("Unknown algorithm")
        };
        var path=result.Path.Select(p=>g.Cells[p.Row*g.Columns+p.Col]).ToArray();
        double distance=0;
        for(int i=1;i<path.Length;i++) {
            double a=path[i-1].CenterLat*Math.PI/180,b=path[i].CenterLat*Math.PI/180;
            double dl=(path[i].CenterLng-path[i-1].CenterLng)*Math.PI/180;
            double hav=Math.Pow(Math.Sin((b-a)/2),2)+Math.Cos(a)*Math.Cos(b)*Math.Pow(Math.Sin(dl/2),2);
            distance+=2*3396.190*Math.Asin(Math.Sqrt(Math.Clamp(hav,0,1)));
        }
        return new { available=path.Length>0,reason=path.Length>0?"Experimental model route, not verified traversability. Endpoints snapped to grid centers.":"No route within the model's covered grid.",
            missingMeasurements=RiskService.Unknowns,path,totalCost=result.TotalCost,avgSafetyScore=result.AvgSafetyScore,
            minSafetyScore=result.MinSafetyScore,distanceKm=distance,modelVersion=RiskService.Version,scientificallyValidated=false,
            accumulatedRisk=path.Skip(1).Sum(c=>c.Assessment.RiskScore),warning=RiskService.Warning };
    }
}
