namespace Backend.Models
{
    /// <summary>
    /// Request DTO for POST /api/grid/generate.
    /// </summary>
    public class GenerateGridRequest
    {
        public double StartLat { get; set; }
        public double EndLat { get; set; }

        public double StartLng { get; set; }
        public double EndLng { get; set; }

        public int Rows { get; set; }
        public int Columns { get; set; }
    }
}
