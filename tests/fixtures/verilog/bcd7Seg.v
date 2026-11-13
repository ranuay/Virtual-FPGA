// The number on SW[3:0] is shown as one digit on HEX0_N; SW[9:4] are not
// used. 0..9 show the digit and 10..15 leave the display blank.
// (The Bab 5 sheet has no arm for 0 or 9, so both of those show blank there.)
module bcd7Seg (
    input  wire [9:0] SW,
    output wire [6:0] HEX0_N,
    output wire [6:0] HEX1_N,
    output wire [6:0] HEX2_N,
    output wire [6:0] HEX3_N,
    output wire [6:0] HEX4_N,
    output wire [6:0] HEX5_N
);
    // Segment bits are gfedcba; a zero lights a segment.
    reg [6:0] segments;

    always @* begin
        case (SW[3:0])
            4'd0: segments = 7'b1000000;
            4'd1: segments = 7'b1111001;
            4'd2: segments = 7'b0100100;
            4'd3: segments = 7'b0110000;
            4'd4: segments = 7'b0011001;
            4'd5: segments = 7'b0010010;
            4'd6: segments = 7'b0000010;
            4'd7: segments = 7'b1111000;
            4'd8: segments = 7'b0000000;
            4'd9: segments = 7'b0010000;
            default: segments = 7'b1111111;   // 10..15: blank
        endcase
    end

    assign HEX0_N = segments;

    // Unused displays: all segments off (active low).
    assign HEX1_N = 7'b1111111;
    assign HEX2_N = 7'b1111111;
    assign HEX3_N = 7'b1111111;
    assign HEX4_N = 7'b1111111;
    assign HEX5_N = 7'b1111111;
endmodule
