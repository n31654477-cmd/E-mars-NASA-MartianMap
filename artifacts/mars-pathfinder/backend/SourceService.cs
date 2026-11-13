using System.Text.Json;
using NetTopologySuite.IO;
using NetTopologySuite.Geometries;
using NetTopologySuite.Index.Strtree;
namespace Mars;

public class SourceService
{
    public readonly string Root;
    public readonly JsonElement Catalog;
    readonly STRtree<(Geometry geometry, JsonElement properties)> index = new();
    public static readonly string[] Missing = ["Elevation DEM", "Slope", "Radiation", "Temperature", "Weather", "Mountain count", "Validated danger thresholds", "Traversability", "Safety score"];
    public const string Warning = "Safety unknown. Geologic context is not a traversability assessment. No scientific route can be computed without supported costs and obstacle criteria.";
    public SourceService()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "research"))) dir = dir.Parent;
        if (dir == null) throw new InvalidOperationException("Workspace data root unavailable");
        Root = dir.FullName;
        Catalog = JsonDocument.Parse(File.ReadAllText(Path.Combine(Root,"artifacts/nasa-data-explorer/public/data/catalog.json"))).RootElement.Clone();
        var rows = JsonDocument.Parse(File.ReadAllText(Data("geology-exact.json"))).RootElement;
        var reader = new WKBReader();
        foreach (var row in rows.EnumerateArray()) {
            var g = reader.Read(Convert.FromHexString(row.GetProperty("wkb").GetString()));
            index.Insert(g.EnvelopeInternal, (g,row.GetProperty("properties").Clone()));
        }
        index.Build();
    }
    public string Data(string name) => Path.Combine(Root,"generated-artifacts/mars-map",name);
    public object Summary() => new {
        title="Mars Surface Analysis", scientificRoutingAvailable=false, limitation=Warning, sourceCount=208,
        algorithms=new[]{
            new { id="bfs", name="BFS", objective="Fewest grid moves", description="FIFO; four neighbors in row−1, col+1, row+1, col−1 order. Not minimum kilometers.", source="Business/ShortestPathAlgorethims.cs" },
            new { id="dijkstra", name="Dijkstra", objective="Minimum entered-cell DF sum", description="Start uncharged; ties by cost, row, column; nonnegative finite weights.", source="Business/SafePathsAlgorithimsGreedy.cs" },
            new { id="astar", name="A*", objective="Minimum entered-cell DF sum", description="Manhattan distance × minimum unblocked DF heuristic; exact original tie-breaking.", source="Business/SafePathsAlgorithimsGreedy.cs" }
        },
        layers=Catalog.GetProperty("layers").EnumerateArray().Select(l => new {
            id=l.GetProperty("id").GetString(), name=l.GetProperty("name").GetString(), filename=Path.GetFileName(l.GetProperty("source").GetString()),
            count=l.GetProperty("count").GetInt32(),units=l.GetProperty("units").GetString(),crs=l.GetProperty("crs").GetString(),sourceUrl=l.GetProperty("sourceUrl").GetString(),
            displayAvailable=new[]{"layer-02","layer-03","layer-04","layer-05"}.Contains(l.GetProperty("id").GetString()),
            role="Source context only; not a safety classification"
        }),
        missingMeasurements=Missing,
        methods=new[]{
            "Originals retained unchanged. All 23 layers remain accessible in the source explorer. Four spherical geographic layers displayed; projected duplicates and annotation layers are not silently combined.",
            "Display vectors only: topology-preserving simplification tolerance 0.025 degrees. Location and grid coverage use full original WKB, not display simplification. Boundary locations can return multiple units.",
            "Contacts include 92 source records with null geometry; retained in feature responses but cannot be drawn. No geometry is invented.",
            "Hillshade display: Robinson Mars sphere to longitude/latitude on radius 3,396,190 m; bilinear resampling to 1800×900. Intensity is not elevation. Original pixels remain unchanged.",
            "Scientific grid uses the original midpoint equations and row/column order. Unknown DF, blocked status and SafetyScore remain null; no implicit zero or safe fallback.",
            "Map scale 1:20,000,000; linework vertex spacing 5 km (sim3292_pamphlet.pdf physical pages 7,10). Not suitable for local rover navigation.",
            "SIM3292 shapefiles use Mars sphere degrees; projected GDB uses meters. The published-map footprint layer uses another Mars ellipsoid. No Earth Web Mercator assumption.",
            "Prototype ComputeDF coefficients and random generator retained only in compatibility source, not used for scientific measurements.",
            "Source data is a local snapshot excluded from deployment; durable storage is required before publishing."
        }
    };
    public IEnumerable<JsonElement> Cover(double lat,double lon) {
        var p=new NetTopologySuite.Geometries.Point(lon,lat);
        return index.Query(p.EnvelopeInternal).Where(x=>x.geometry.Covers(p)).Select(x=>x.properties).ToList();
    }
    public object Inspect(double lat,double lon) => new {
        latitude=lat,longitude=lon,status="unknown", warning=Warning,missingMeasurements=Missing,
        evidence=Cover(lat,lon).Select(p=>new {
            layerId="layer-03",filename=p.GetProperty("_source").GetProperty("filename").GetString(),
            layer="SIM3292_Global_Geology",featureId=p.GetProperty("_source").GetProperty("featureId").GetInt32(),
            sourceUrl=Catalog.GetProperty("layers")[2].GetProperty("sourceUrl").GetString(),properties=p
        })
    };
}
