// Press btnC to count up and btnU to count down; the digit wraps 0..9.
// The count is shown on digit 0; the other digits stay dark.
// CLOCK_500Hz is provided by HDLBoard, not by the physical board: on hardware
// this design needs a clock divider instead.
module upDownCounter7Seg (
    input  wire       CLOCK_500Hz,
    input  wire       btnC,
    input  wire       btnU,
    output wire [6:0] seg,
    output wire       dp,
    output wire [3:0] an
);
    // Segment bits are gfedcba; a zero lights a segment.
    function [6:0] to_segments(input [3:0] digit);
        case (digit)
            4'd0: to_segments = 7'b1000000;
            4'd1: to_segments = 7'b1111001;
            4'd2: to_segments = 7'b0100100;
            4'd3: to_segments = 7'b0110000;
            4'd4: to_segments = 7'b0011001;
            4'd5: to_segments = 7'b0010010;
            4'd6: to_segments = 7'b0000010;
            4'd7: to_segments = 7'b1111000;
            4'd8: to_segments = 7'b0000000;
            4'd9: to_segments = 7'b0010000;
            default: to_segments = 7'b1111111;
        endcase
    endfunction

    reg [3:0] count = 4'd0;
    // The buttons as they were on the previous clock edge: a press is the
    // edge where a button goes from released (0) to pressed (1).
    reg [1:0] btn_prev = 2'b00;

    always @(posedge CLOCK_500Hz) begin
        btn_prev <= {btnC, btnU};

        if (!btn_prev[1] && btnC) begin      // btnC: count up
            count <= (count == 4'd9) ? 4'd0 : count + 4'd1;
        end else if (!btn_prev[0] && btnU) begin   // btnU: count down
            count <= (count == 4'd0) ? 4'd9 : count - 4'd1;
        end
    end

    assign seg = to_segments(count);
    assign dp = 1'b1;                  // Decimal point off (active low).
    assign an = 4'b1110;               // Digit 0 only; the rest stay dark.
endmodule
