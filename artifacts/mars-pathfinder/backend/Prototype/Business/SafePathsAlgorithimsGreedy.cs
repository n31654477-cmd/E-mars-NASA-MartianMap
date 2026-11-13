using Backend.Models;

namespace Backend.Business
{
    public class TheSafestPathsAlgorithms
    {
        //Dijkstra
        public static PathResult TheSafestPathDijkstra(
             Cell[][] grid,
             Point start,
             Point destination)
        {
            AlgorithmsValidator.ValidateRequest(grid, start, destination);
            AlgorithmsValidator.ValidateNonnegativeWeights(grid);

            int rows = grid.Length;
            int cols = grid[0].Length;

            double[,] distances = InitializeDistances(rows, cols);
            Point[,] parents = new Point[rows, cols];
            bool[,] visited = new bool[rows, cols];

            SortedSet<(double Cost, int Row, int Col)> frontier =
                CreatePriorityQueue();

            distances[start.Row, start.Col] = 0;
            frontier.Add((0, start.Row, start.Col));

            while (frontier.Count > 0)
            {
                var current = frontier.Min;
                frontier.Remove(current);

                int row = current.Row;
                int col = current.Col;

                if (visited[row, col])
                    continue;

                visited[row, col] = true;

                Point currentPoint = new Point
                {
                    Row = row,
                    Col = col
                };

                if (AlgorithmsCommon.AreSamePoint(currentPoint, destination))
                    break;

                foreach (Point neighbor in AlgorithmsCommon.GetNeighbors(currentPoint, rows, cols))
                {
                    int neighborRow = neighbor.Row;
                    int neighborCol = neighbor.Col;

                    if (visited[neighborRow, neighborCol] ||
                        grid[neighborRow][neighborCol].Blocked)
                    {
                        continue;
                    }

                    RelaxEdge(
                        grid,
                        currentPoint,
                        neighbor,
                        distances,
                        parents,
                        frontier);
                }
            }

            List<Point> path = AlgorithmsCommon.ReconstructPath(parents, start, destination);

            if (path.Count == 0)
                return new PathResult();

            return AlgorithmsCommon.BuildResult(
                grid,
                path,
                distances[destination.Row, destination.Col]);
        }

        private static double[,] InitializeDistances(int rows, int cols)
        {
            double[,] distances = new double[rows, cols];

            for (int row = 0; row < rows; row++)
            {
                for (int col = 0; col < cols; col++)
                    distances[row, col] = double.PositiveInfinity;
            }

            return distances;
        }

        private static SortedSet<(double Cost, int Row, int Col)> CreatePriorityQueue()
        {
            return new SortedSet<(double Cost, int Row, int Col)>(
                Comparer<(double Cost, int Row, int Col)>.Create((first, second) =>
                {
                    int comparison = first.Cost.CompareTo(second.Cost);

                    if (comparison != 0)
                        return comparison;

                    comparison = first.Row.CompareTo(second.Row);

                    return comparison != 0
                        ? comparison
                        : first.Col.CompareTo(second.Col);
                }));
        }

        private static void RelaxEdge(
            Cell[][] grid,
            Point current,
            Point neighbor,
            double[,] distances,
            Point[,] parents,
            SortedSet<(double Cost, int Row, int Col)> frontier)
        {
            int currentRow = current.Row;
            int currentCol = current.Col;
            int neighborRow = neighbor.Row;
            int neighborCol = neighbor.Col;

            double newCost =
                distances[currentRow, currentCol] +
                grid[neighborRow][neighborCol].DF;

            if (newCost >= distances[neighborRow, neighborCol])
                return;

            double oldCost = distances[neighborRow, neighborCol];

            if (!double.IsPositiveInfinity(oldCost))
                frontier.Remove((oldCost, neighborRow, neighborCol));

            distances[neighborRow, neighborCol] = newCost;
            parents[neighborRow, neighborCol] = current;

            frontier.Add((newCost, neighborRow, neighborCol));
        }


        //A star

        public static PathResult FindPathAStar(
          Cell[][] grid,
          Point start,
          Point destination)
        {
           AlgorithmsValidator.ValidateRequest(grid, start, destination);
           AlgorithmsValidator.ValidateNonnegativeWeights(grid);

            int rows = grid.Length;
            int cols = grid[0].Length;

            double minimumDF = FindMinimumDF(grid);

            double[,] gScores = InitializeDistances(rows, cols);
            Point[,] parents = new Point[rows, cols];
            bool[,] visited = new bool[rows, cols];

            var frontier = CreatePriorityQueue();

            gScores[start.Row, start.Col] = 0;

            frontier.Add((
                CalculateHeuristic(start, destination, minimumDF),
                start.Row,
                start.Col));

            while (frontier.Count > 0)
            {
                var current = frontier.Min;
                frontier.Remove(current);

                int row = current.Row;
                int col = current.Col;

                if (visited[row, col])
                    continue;

                visited[row, col] = true;

                Point currentPoint = new Point
                {
                    Row = row,
                    Col = col
                };

                if (AlgorithmsCommon.AreSamePoint(currentPoint, destination))
                    break;

                foreach (Point neighbor in AlgorithmsCommon.GetNeighbors(currentPoint, rows, cols))
                {
                    int r = neighbor.Row;
                    int c = neighbor.Col;

                    if (visited[r, c] || grid[r][c].Blocked)
                        continue;

                    RelaxAStarEdge(
                        grid,
                        currentPoint,
                        neighbor,
                        destination,
                        minimumDF,
                        gScores,
                        parents,
                        frontier);
                }
            }

            if (double.IsPositiveInfinity(
                gScores[destination.Row, destination.Col]))
            {
                return new PathResult();
            }

            List<Point> path = AlgorithmsCommon.ReconstructPath(
                parents,
                start,
                destination);

            return AlgorithmsCommon.BuildResult(
                grid,
                path,
                gScores[destination.Row, destination.Col]);
        }

        private static double CalculateHeuristic(
            Point current,
            Point destination,
            double minimumDF)
        {
            int distance =
                Math.Abs(current.Row - destination.Row) +
                Math.Abs(current.Col - destination.Col);

            return distance * minimumDF;
        }

        private static double FindMinimumDF(Cell[][] grid)
        {
            double minimumDF = double.PositiveInfinity;

            foreach (Cell[] row in grid)
            {
                foreach (Cell cell in row)
                {
                    if (!cell.Blocked)
                        minimumDF = Math.Min(minimumDF, cell.DF);
                }
            }

            return minimumDF;
        }

        private static void RelaxAStarEdge(
            Cell[][] grid,
            Point current,
            Point neighbor,
            Point destination,
            double minimumDF,
            double[,] gScores,
            Point[,] parents,
            SortedSet<(double Cost, int Row, int Col)> frontier)
        {
            int row = neighbor.Row;
            int col = neighbor.Col;

            double newG =
                gScores[current.Row, current.Col] +
                grid[row][col].DF;

            if (newG >= gScores[row, col])
                return;

            double oldG = gScores[row, col];

            if (!double.IsPositiveInfinity(oldG))
            {
                double oldF = oldG +
                    CalculateHeuristic(neighbor, destination, minimumDF);

                frontier.Remove((oldF, row, col));
            }

            gScores[row, col] = newG;
            parents[row, col] = current;

            double newF = newG +
                CalculateHeuristic(neighbor, destination, minimumDF);

            frontier.Add((newF, row, col));
        }

    }
}
