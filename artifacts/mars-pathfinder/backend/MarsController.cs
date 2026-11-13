using Microsoft.AspNetCore.Mvc;
namespace Mars;
public record GridInput(double StartLat,double EndLat,double StartLng,double EndLng,int Rows,int Columns);
public record RouteInput(string Algorithm,double StartLat,double StartLng,double EndLat,double EndLng);
[ApiController]
[Route("api/mars")]
public class MarsController(SourceService sources,LabService lab):ControllerBase {
    [HttpGet("summary")] public object Summary()=>sources.Summary();
    [HttpGet("layers/{id}/features")] public IActionResult Features(string id) {
        if(!new[]{"layer-02","layer-03","layer-04","layer-05"}.Contains(id)) return NotFound(new{error="Layer is catalogued but unavailable for this display projection"});
        return PhysicalFile(sources.Data(id+".json"),"application/json");
    }
    [HttpGet("inspect")] public IActionResult Inspect(double latitude,double longitude) {
        if(!Valid(latitude,longitude)) return BadRequest(new{error="Coordinates must be finite Mars degrees within ±90 latitude and ±180 longitude"});
        return Ok(sources.Inspect(latitude,longitude));
    }
    static bool Valid(double lat,double lon)=>double.IsFinite(lat)&&double.IsFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
    [HttpPost("grid")] public IActionResult Grid(GridInput r) {
        if(r.Rows<1||r.Rows>80||r.Columns<1||r.Columns>80||!Valid(r.StartLat,r.StartLng)||!Valid(r.EndLat,r.EndLng)||r.StartLat>=r.EndLat||r.StartLng>=r.EndLng)
            return BadRequest(new{error="Use 1–80 rows/columns and increasing valid geographic bounds; longitude seam wrapping is not supported."});
        double h=(r.EndLat-r.StartLat)/r.Rows,w=(r.EndLng-r.StartLng)/r.Columns;
        var cells=Enumerable.Range(0,r.Rows).SelectMany(row=>Enumerable.Range(0,r.Columns).Select(col=>{
            double lat=r.StartLat+(row+0.5)*h,lon=r.StartLng+(col+0.5)*w;
            return new{row,col,centerLat=lat,centerLng=lon,width=w,height=h,safetyStatus="unknown",blocked=(bool?)null,df=(double?)null,safetyScore=(double?)null,
                units=sources.Cover(lat,lon).Select(p=>p.GetProperty("Unit").GetString()).ToArray()};
        })).ToArray();
        return Ok(new{rows=r.Rows,columns=r.Columns,cells,warning=SourceService.Warning});
    }
    [HttpPost("route")] public IActionResult Route(RouteInput r) {
        if(!Valid(r.StartLat,r.StartLng)||!Valid(r.EndLat,r.EndLng)||!new[]{"bfs","dijkstra","astar"}.Contains(r.Algorithm)) return BadRequest(new{error="Invalid coordinates or algorithm"});
        return Ok(new{available=false,reason=SourceService.Warning,missingMeasurements=SourceService.Missing});
    }
    [HttpPost("lab")] public IActionResult Lab(LabInput r) {
        try{return Ok(lab.Run(r));} catch(ArgumentException e){return BadRequest(new{error=e.Message});}
    }
}
