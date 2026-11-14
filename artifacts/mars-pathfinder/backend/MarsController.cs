using Microsoft.AspNetCore.Mvc;
namespace Mars;
public record GridInput(double StartLat,double EndLat,double StartLng,double EndLng,int Rows,int Columns);
public record RouteInput(string Algorithm,double StartLat,double StartLng,double EndLat,double EndLng,GridInput Grid,HazardEventSpec[]? Events=null);
[ApiController]
[Route("api/mars")]
public class MarsController(SourceService sources,LabService lab,GridService grids,HazardService hazards):ControllerBase {
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
        try{return Ok(grids.Generate(r));}catch(ArgumentException e){return BadRequest(new{error=e.Message});}
    }
    [HttpPost("route")] public IActionResult Route(RouteInput r) {
        if(!Valid(r.StartLat,r.StartLng)||!Valid(r.EndLat,r.EndLng)||!new[]{"bfs","dijkstra","astar"}.Contains(r.Algorithm)) return BadRequest(new{error="Invalid coordinates or algorithm"});
        try{return Ok(grids.Route(r));}catch(ArgumentException e){return BadRequest(new{error=e.Message});}
    }
    [HttpPost("event")] public IActionResult Event(ScenarioInput r) {
        try{return Ok(hazards.Simulate(r));}catch(ArgumentException e){return BadRequest(new{error=e.Message});}
    }
    [HttpPost("lab")] public IActionResult Lab(LabInput r) {
        try{return Ok(lab.Run(r));} catch(ArgumentException e){return BadRequest(new{error=e.Message});}
    }
}
