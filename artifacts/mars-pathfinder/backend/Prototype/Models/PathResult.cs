using System.Collections.Generic;

namespace Backend.Models
{
    /// <summary>
    /// Response DTO containing the selected path and its metrics.
    /// </summary>
    public class PathResult
    {
        public List<Point> Path { get; set; } = new List<Point>();
        public double TotalCost { get; set; }
        public double AvgSafetyScore { get; set; }
        public double MinSafetyScore { get; set; }
    }
}
