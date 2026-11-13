namespace Backend.Models
{
    /// <summary>
    /// Response DTO for grid generation.
    /// </summary>
    public class GridResult
    {
        public int Rows { get; set; }
        public int Columns { get; set; }

        public Cell[][] Cells { get; set; } = System.Array.Empty<Cell[]>();
    }
}