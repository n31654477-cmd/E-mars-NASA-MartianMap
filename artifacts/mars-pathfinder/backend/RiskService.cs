using System.Text.Json;
namespace Mars;
public record RiskFactor(string Id,string Name,double Weight,double RawScore,double Contribution,string Basis);
public record RiskEvidence(string Filename,string Layer,int FeatureId,string Value);
public record RiskAssessment(string ModelVersion,double RiskScore,double ModelSafetyScore,double MovementCost,bool GeologyCovered,
    string Status,RiskFactor[] Factors,RiskEvidence[] Evidence,string[] Unknowns,string Warning);
public record RiskRule(string Name,double Score,string Match);
public record RiskDefinition(string Id,string Name,double Weight,string Rationale,RiskRule[] Rules);
public class RiskService(SourceService sources) {
    public static readonly string[] Unknowns=["Elevation","Slope","Radiation","Temperature","Weather","Rock size / wheel interaction","Soil bearing strength"];
    public const string Version="sim3292-proxy-1";
    public const string Warning="Experimental ordinal proxy, not a probability or validated safety assessment. Lower scores do not establish safe or traversable terrain.";
    public static readonly RiskRule[] TerrainRules=[
        new("Polar / dunes",1,"Description contains polar or dune"),
        new("Apron / massif / edifice",0.8,"Description contains apron, massif or edifice"),
        new("Highland / impact / transition",0.6,"Description contains highland, impact or transition"),
        new("Volcanic",0.5,"Description contains volcanic"),
        new("Basin / lowland",0.3,"Description contains basin or lowland"),
        new("Unknown / unmatched",1,"No description or no recognized category; precautionary model penalty")
    ];
    public static readonly RiskRule[] StructureRules=[
        new("Scarp / caldera rim / crater rim / pit crater chain",1,"Exact Interpreta category"),
        new("Graben axis / Channel axis / Outflow Channel / Spiral trough / Rille",0.8,"Exact Interpreta category"),
        new("Wrinkle ridge / Ridge / Yardangs",0.6,"Exact Interpreta category"),
        new("Lobate flow",0.4,"Exact Interpreta category"),
        new("Other / unrecognized mapped feature",1,"Precautionary model penalty"),
        new("No mapped intersection",0,"No mapped structure intersects the cell; NOT proof of absence")
    ];
    public static object Model => new {
        version=Version, formula="R = 45 × T + 35 × M + 20 × U; modelSafety = 100 − R; DF = 1 + R/100",
        warning=Warning,
        calibration="Weights and category scores are explicit analyst-selected assumptions requested by the user. Neither NASA/JPL nor SIM3292 establishes these numeric weights or verifies this category ordering.",
        spatialPolicy="T is the maximum terrain score among exact polygons covering the cell midpoint. M is the maximum score of any exact structure intersecting the full rectangular cell. U=(7+g)/8, where g=1 when midpoint geology is missing, otherwise 0. Missing physical measurements are never replaced with zero. Grids must not cross the longitude seam.",
        routingPolicy="Unchanged BFS minimizes steps; unchanged Dijkstra/A* minimize entered-cell DF. Start uncharged. Model assumes cells with midpoint geology can be crossed; missing-geology cells are excluded by data policy, not a physical obstacle claim. Distances are derived center-to-center Mars-sphere distances, not optimized by BFS. Endpoint markers snap to their grid-cell centers.",
        factors=new[]{
            new RiskDefinition("terrain","Geological terrain association",45,"Broad terrain association gets the largest scenario weight, but unit names do not measure soil mechanics, rock abundance or local slope.",TerrainRules),
            new RiskDefinition("structure","Mapped structural features",35,"Rims, scarps and troughs may indicate relief changes relevant to mobility. Their mapped presence does not quantify gradient, height or crossability.",StructureRules),
            new RiskDefinition("uncertainty","Missing-data penalty",20,"Seven of eight evidence categories are always missing: elevation, slope, radiation, temperature, weather, rock size and soil bearing strength. Geological description is the eighth.",[
                new("Geology present; seven categories missing",0.875,"U = 7/8; contribution 17.5"),
                new("Geology missing; all eight categories missing",1,"U = 8/8; contribution 20")
            ])
        },
        exclusions=new[]{"Contacts and geologic age are not numeric hazards","Landing-site proximity is not safety evidence","Hillshade brightness is not elevation or slope","No invented radiation, temperature or weather values","No numeric score is a validated blocked-cell threshold","No low-score area is labelled safe"},
        references=new[]{
            new {title="SIM3292 geology, structure and map context",url="https://doi.org/10.3133/sim3292",locator="SIM3292_Global_Geology.shp / Unit, UnitDesc; SIM3292_Global_Structure.shp / Interpreta; sim3292_map.pdf p.1; pamphlet physical pp.7,10"},
            new {title="JPL: Curiosity checking a smoother route",url="https://www.jpl.nasa.gov/news/curiosity-mars-rover-checking-possible-smoother-route/",locator="2014-01-29; sharp-rock wheel damage, dunes and scarps motivate qualitative relevance only. Does NOT supply these weights."}
        }
    };
    public static double TerrainScore(string description) {
        var s=(description??"").ToLowerInvariant();
        if(s.Contains("polar")||s.Contains("dune"))return 1;
        if(new[]{"apron","massif","edifice"}.Any(s.Contains))return .8;
        if(new[]{"highland","impact","transition"}.Any(s.Contains))return .6;
        if(s.Contains("volcanic"))return .5;
        if(s.Contains("basin")||s.Contains("lowland"))return .3;
        return 1;
    }
    public static double StructureScore(string name) => name switch {
        "Scarp" or "Caldera rim" or "Crater rim" or "Pit crater chain"=>1,
        "Graben axis" or "Channel axis" or "Outflow Channel" or "Spiral trough" or "Rille"=>.8,
        "Wrinkle ridge" or "Ridge" or "Yardangs"=>.6,
        "Lobate flow"=>.4,_=>1
    };
    public static RiskAssessment Combine(JsonElement[] geology,JsonElement[] structures) {
        double t=geology.Length==0?1:geology.Max(g=>TerrainScore(g.GetProperty("UnitDesc").GetString()));
        double m=structures.Length==0?0:structures.Max(g=>StructureScore(g.GetProperty("Interpreta").GetString()));
        double u=geology.Length==0?1:.875;
        RiskFactor[] factors=[
            new("terrain","Geological terrain association",45,t,45*t,geology.Length==0?"Missing geology: precautionary T=1":"Maximum category at cell midpoint; not measured roughness"),
            new("structure","Mapped structural features",35,m,35*m,structures.Length==0?"No mapped intersection; not evidence of no local hazards":"Maximum mapped Interpreta category intersecting cell"),
            new("uncertainty","Missing-data penalty",20,u,20*u,"7/8 categories missing, plus missing geology when applicable")
        ];
        var evidence=geology.Concat(structures).Select(p=>{
            var s=p.GetProperty("_source");
            return new RiskEvidence(s.GetProperty("filename").GetString(),s.GetProperty("layer").GetString(),s.GetProperty("featureId").GetInt32(),
                p.TryGetProperty("UnitDesc",out var d)?d.GetString():p.GetProperty("Interpreta").GetString());
        }).ToArray();
        double risk=factors.Sum(f=>f.Contribution);
        return new(Version,risk,100-risk,1+risk/100,geology.Length>0,"experimental",factors,evidence,
            geology.Length>0?Unknowns:[..Unknowns,"Geological description"],Warning);
    }
    public RiskAssessment Assess(double lat,double lon,double width,double height)=>Combine(sources.Cover(lat,lon).ToArray(),sources.Structures(lat,lon,width,height).ToArray());
}
