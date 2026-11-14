namespace Mars;

// Scenario increments are separate from immutable source observations. They are
// replayed on a freshly derived grid so requests cannot silently replace evidence.
public record HazardEventSpec(int Row,int Col,string Factor,double Delta);
public record ScenarioInput(RouteInput Route,int? Seed=null);
public record EventChange(int Row,int Col,bool Origin,double AreaKm2,double FactorBefore,double FactorAfter,double DfBefore,double DfAfter,double DeltaDf);
public record EventDetail(int Seed,HazardEventSpec Spec,EventChange[] Changes,string Formula,string Warning);
public record ScenarioResult(ScientificGrid Grid,ScientificRoute OldRoute,ScientificRoute NewRoute,EventDetail Event,HazardEventSpec[] Events);

public class HazardService(GridService grids)
{
    public const int MaxEvents=50;
    public const double ReferenceAreaKm2=10000;
    public const string Formula="Origin δf ∈ [min(0.05,1−f), min(0.25,1−f)]; neighbor δf = min(1−f, origin δf × 0.5 / (1 + A/10000) / sqrt(dr²+dc²)); ΔDF = weight × δf / 100.";
    public const string Warning="Synthetic what-if event, not an observed Mars hazard or calibrated hazard probability. Only normalized terrain/structure factors increase; source evidence and missing measurements remain unchanged. Residual inequality applies to added danger, not absolute pre-existing scores.";

    public static double AreaKm2(ScientificCell cell)
    {
        const double r=3396.190;
        double radians=Math.PI/180;
        return r*r*cell.Width*radians*Math.Abs(Math.Sin((cell.CenterLat+cell.Height/2)*radians)-Math.Sin((cell.CenterLat-cell.Height/2)*radians));
    }
    public static double Residual(double originDelta,double areaKm2,int dr,int dc)
    {
        if(!double.IsFinite(originDelta)||originDelta<=0||!double.IsFinite(areaKm2)||areaKm2<=0||
           Math.Abs(dr)>1||Math.Abs(dc)>1||(dr==0&&dc==0))return 0;
        return originDelta*.5/(1+areaKm2/ReferenceAreaKm2)/Math.Sqrt(dr*dr+dc*dc);
    }
    public static (ScientificGrid Grid,EventChange[] Changes) Apply(ScientificGrid grid,HazardEventSpec e)
    {
        if(e==null||e.Row<0||e.Row>=grid.Rows||e.Col<0||e.Col>=grid.Columns||
           e.Factor is not ("terrain" or "structure")||!double.IsFinite(e.Delta)||e.Delta<=0||e.Delta>.25)
            throw new ArgumentException("Events require a grid cell, terrain/structure factor, and finite increment in (0,0.25].");
        var origin=grid.Cells[e.Row*grid.Columns+e.Col];
        var factor=origin.Assessment.Factors.Single(f=>f.Id==e.Factor);
        if(!origin.Assessment.GeologyCovered||factor.RawScore>=1||e.Delta>1-factor.RawScore+1e-12)
            throw new ArgumentException("Event origin must have geology coverage and enough factor headroom below 1.");
        var cells=(ScientificCell[])grid.Cells.Clone();
        var changes=new List<EventChange>();
        for(int dr=-1;dr<=1;dr++) for(int dc=-1;dc<=1;dc++)
        {
            int row=e.Row+dr,col=e.Col+dc;
            if(row<0||col<0||row>=grid.Rows||col>=grid.Columns)continue;
            int index=row*grid.Columns+col;
            var c=cells[index];
            if(!c.Assessment.GeologyCovered)continue;
            var f=c.Assessment.Factors.Single(f=>f.Id==e.Factor);
            bool isOrigin=dr==0&&dc==0;
            double area=AreaKm2(c);
            double delta=Math.Min(1-f.RawScore,isOrigin?e.Delta:Residual(e.Delta,area,dr,dc));
            if(delta<=0)continue;
            double raw=Math.Min(1,f.RawScore+delta);
            var factors=c.Assessment.Factors.Select(x=>x.Id!=e.Factor?x:x with {
                RawScore=raw,Contribution=x.Weight*raw,
                Basis=x.Basis+"; simulated event increase (not a new source observation)"
            }).ToArray();
            double score=factors.Sum(x=>x.Contribution);
            var assessment=c.Assessment with { Factors=factors,RiskScore=score,ModelSafetyScore=100-score,MovementCost=1+score/100,
                Status="simulated",Warning=RiskService.Warning+" "+Warning };
            var updated=c with { Df=assessment.MovementCost,SafetyScore=assessment.ModelSafetyScore,SafetyStatus="simulated",Assessment=assessment };
            cells[index]=updated;
            changes.Add(new(row,col,isOrigin,area,f.RawScore,raw,c.Df,updated.Df,updated.Df-c.Df));
        }
        return (grid with { Cells=cells,Warning=RiskService.Warning+" "+Warning },changes.ToArray());
    }
    public static ScientificGrid ApplyHistory(ScientificGrid grid,HazardEventSpec[]? events)
    {
        if(events==null)return grid;
        if(events.Length>MaxEvents)throw new ArgumentException($"Reset the scenario after {MaxEvents} events.");
        foreach(var e in events)grid=Apply(grid,e).Grid;
        return grid;
    }
    public ScenarioResult Simulate(ScenarioInput input)
    {
        if(input?.Route?.Grid==null)throw new ArgumentException("A route and grid bounds are required.");
        var r=input.Route;
        var history=r.Events??[];
        if(history.Length>=MaxEvents)throw new ArgumentException($"Reset the scenario after {MaxEvents} events.");
        var grid=ApplyHistory(grids.Generate(r.Grid),history);
        var oldRoute=grids.RouteOnGrid(r,grid);
        if(!oldRoute.Available||oldRoute.Path.Length<2)
            throw new ArgumentException("Generate a route between different cells before simulating an event.");
        // Start is uncharged by the original algorithms, so select only entered
        // path cells. Pick an eligible cell uniformly, then an eligible factor.
        var candidates=oldRoute.Path.Skip(1).Where(c=>c.Assessment.Factors.Any(f=>f.Id is "terrain" or "structure" && f.RawScore<1-1e-10)).ToArray();
        if(candidates.Length==0)throw new ArgumentException("All terrain/structure factors on entered route cells are saturated. Reset the scenario or choose another route.");
        int seed=input.Seed??Random.Shared.Next();
        var random=new Random(seed);
        var cell=candidates[random.Next(candidates.Length)];
        var options=cell.Assessment.Factors.Where(f=>f.Id is "terrain" or "structure" && f.RawScore<1-1e-10).ToArray();
        var factor=options[random.Next(options.Length)];
        double headroom=1-factor.RawScore,lo=Math.Min(.05,headroom),hi=Math.Min(.25,headroom);
        var spec=new HazardEventSpec(cell.Row,cell.Col,factor.Id,lo+random.NextDouble()*(hi-lo));
        var (updated,changes)=Apply(grid,spec);
        return new(updated,oldRoute,grids.RouteOnGrid(r,updated),new(seed,spec,changes,Formula,Warning),[..history,spec]);
    }
}
