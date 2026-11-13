namespace Backend.Models
{
    /// <summary>
    /// Request DTO for path-finding endpoints.
    /// </summary>
    public class PathRequest
    {
        public Cell[][] Grid { get; set; } = System.Array.Empty<Cell[]>();
        public Point Start { get; set; } = new Point();
        public Point End { get; set; } = new Point();
    }
}
