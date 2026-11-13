using Backend.Models;

namespace Backend.Business
{
    public class AlgorithmsValidator
    {

        public static bool IsInsideGrid(
         int row,
         int col,
         int rows,
         int cols)
        {
            return row >= 0 &&
                   row < rows &&
                   col >= 0 &&
                   col < cols;
        }


        public static void ValidateRequest(
          Cell[][] grid,
          Point start,
          Point destination)
        {
            if (grid == null || grid.Length == 0 || grid[0] == null ||
                grid[0].Length == 0)
            {
                throw new ArgumentException("Grid cannot be empty.");
            }

            int rows = grid.Length;
            int cols = grid[0].Length;

            for (int row = 0; row < rows; row++)
            {
                if (grid[row] == null || grid[row].Length != cols)
                    throw new ArgumentException("Grid must be rectangular.");

                for (int col = 0; col < cols; col++)
                {
                    if (grid[row][col] == null)
                        throw new ArgumentException("Grid cannot contain null cells.");
                }
            }

            if (start == null || destination == null)
                throw new ArgumentException("Start and destination cannot be null.");

            if (!IsInsideGrid(start.Row, start.Col, rows, cols) ||
                !IsInsideGrid(destination.Row, destination.Col, rows, cols))
            {
                throw new ArgumentOutOfRangeException(
                    "Start or destination is outside the grid.");
            }

            if (grid[start.Row][start.Col].Blocked ||
                grid[destination.Row][destination.Col].Blocked)
            {
                throw new ArgumentException(
                    "Start and destination must be unblocked.");
            }
        }


        public static void ValidateNonnegativeWeights(Cell[][] grid)
        {
            foreach (Cell[] row in grid)
            {
                foreach (Cell cell in row)
                {
                    if (!cell.Blocked &&
                        (double.IsNaN(cell.DF) ||
                         double.IsInfinity(cell.DF) ||
                         cell.DF < 0))
                    {
                        throw new ArgumentException(
                            "Dijkstra requires finite, nonnegative DF values.");
                    }
                }
            }
        }
    }
}

