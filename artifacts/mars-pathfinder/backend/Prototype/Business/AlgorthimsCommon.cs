using Backend.Models;

namespace Backend.Business
{
    public class AlgorithmsCommon
    {
        private static readonly int[] RowDirections = { -1, 0, 1, 0 };
        private static readonly int[] ColDirections = { 0, 1, 0, -1 };

        public static bool AreSamePoint(Point first, Point second)
        {
            return first.Row == second.Row &&
                   first.Col == second.Col;
        }

        public static List<Point> ReconstructPath(
          Point[,] parents,
          Point start,
          Point destination)
        {
            List<Point> path = new List<Point>();
            Point current = destination;

            while (true)
            {
                path.Add(new Point
                {
                    Row = current.Row,
                    Col = current.Col
                });

                if (AreSamePoint(current, start))
                    break;

                Point parent = parents[current.Row, current.Col];

                if (parent == null)
                    return new List<Point>();

                current = parent;
            }

            path.Reverse();
            return path;
        }

        public static double CalculatePathCost(
           Cell[][] grid,
           List<Point> path)
        {
            double totalCost = 0;

            // The starting cell is not charged; each entered cell contributes DF.
            for (int index = 1; index < path.Count; index++)
            {
                Point point = path[index];
                totalCost += grid[point.Row][point.Col].DF;
            }

            return totalCost;
        }

        public static PathResult BuildResult(
         Cell[][] grid,
         List<Point> path,
         double? totalCost = null)
        {
            if (path.Count == 0)
                return new PathResult();

            double totalSafetyScore = 0;
            double minimumSafetyScore = double.MaxValue;

            foreach (Point point in path)
            {
                double safetyScore = grid[point.Row][point.Col].SafetyScore;

                totalSafetyScore += safetyScore;
                minimumSafetyScore = Math.Min(minimumSafetyScore, safetyScore);
            }

            return new PathResult
            {
                Path = path,
                TotalCost = totalCost ?? CalculatePathCost(grid, path),
                AvgSafetyScore = totalSafetyScore / path.Count,
                MinSafetyScore = minimumSafetyScore
            };
        }

        public static IEnumerable<Point> GetNeighbors(
           Point current,
           int rows,
           int cols)
        {
            for (int direction = 0; direction < RowDirections.Length; direction++)
            {
                int row = current.Row + RowDirections[direction];
                int col = current.Col + ColDirections[direction];

                if (! AlgorithmsValidator.IsInsideGrid(row, col, rows, cols))
                    continue;

                yield return new Point
                {
                    Row = row,
                    Col = col
                };
            }
        }
    }
}
